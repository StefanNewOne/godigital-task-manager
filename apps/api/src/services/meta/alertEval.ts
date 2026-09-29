import {
  ALERT_CATALOG,
  adNotDelivering,
  alertDedupeKey,
  endingSoon,
  frequencyHigh,
  spendCapReached,
  type AlertCode,
} from '@gd/core';
import type { MetaAlertSeverity, Prisma } from '@gd/db';
import { prisma } from '../../db/tenantExtension.js';

/**
 * Модул 3 · Мета — евалуација на алерти (§13) над огледалото. Алертите живеат САМО во Мета
 * (не во постоечкиот „Аларми" панел, D5). Групирање по dedupeKey; авто-`resolved` кога условот
 * исчезне. Имплементирани: A01, A02, A04, A05, A06, A09, A10.
 */

const num = (v: unknown): number | null => (v == null ? null : Number(v));

interface Firing {
  code: AlertCode;
  objectType: string;
  objectMetaId: string | null;
  detail: string;
}

/** Account статус што не е активен (Meta: 1=ACTIVE; сè друго = проблем). */
function accountDisabled(status: string | null): boolean {
  if (!status) return false;
  return status !== '1' && status.toUpperCase() !== 'ACTIVE';
}

/** Пресметај ги алертите што горат за еден клиент. */
async function firingForClient(clientId: string, freqThreshold: number): Promise<Firing[]> {
  const out: Firing[] = [];
  const now = new Date();

  const conns = await prisma.metaConnection.findMany({ where: { clientId, kind: 'adAccount' } });
  for (const conn of conns) {
    if (accountDisabled(conn.accountStatus)) {
      out.push({
        code: 'A02',
        objectType: 'adAccount',
        objectMetaId: conn.metaId,
        detail: `Акаунт ${conn.metaId} е оневозможен.`,
      });
    }
    if (spendCapReached(num(conn.amountSpent), num(conn.spendCap))) {
      out.push({
        code: 'A04',
        objectType: 'adAccount',
        objectMetaId: conn.metaId,
        detail: `Потрошено ${conn.amountSpent} од ${conn.spendCap}.`,
      });
    }
  }

  const campaigns = await prisma.metaCampaign.findMany({ where: { clientId } });
  const today = new Date().toISOString().slice(0, 10);
  for (const c of campaigns) {
    if (endingSoon(c.stopTime, now)) {
      out.push({
        code: 'A10',
        objectType: 'campaign',
        objectMetaId: c.metaId,
        detail: `„${c.name}" завршува наскоро.`,
      });
    }
    if (c.effectiveStatus === 'ACTIVE') {
      const ins = await prisma.metaInsightDaily.findUnique({
        where: {
          level_objectMetaId_date: {
            level: 'campaign',
            objectMetaId: c.metaId,
            date: new Date(`${today}T00:00:00.000Z`),
          },
        },
      });
      if (ins && Number(ins.spend) === 0) {
        out.push({
          code: 'A05',
          objectType: 'campaign',
          objectMetaId: c.metaId,
          detail: `„${c.name}" активна без трошок денес.`,
        });
      }
    }
  }

  // Ads: A01 (одбиена) + A06 (не се испорачува)
  const ads = await prisma.metaAd.findMany({
    where: { adSet: { campaign: { clientId } } },
  });
  for (const ad of ads) {
    if (ad.reviewStatus === 'rejected') {
      out.push({
        code: 'A01',
        objectType: 'ad',
        objectMetaId: ad.metaId,
        detail: `Рекламата „${ad.name}" е одбиена.`,
      });
    } else if (adNotDelivering(ad.status, ad.effectiveStatus)) {
      out.push({
        code: 'A06',
        objectType: 'ad',
        objectMetaId: ad.metaId,
        detail: `Рекламата „${ad.name}" не се испорачува (${ad.effectiveStatus}).`,
      });
    }
  }

  // A09: фреквенција (денешен ad-level insight над прагот)
  const adInsights = await prisma.metaInsightDaily.findMany({
    where: { clientId, level: 'ad', date: new Date(`${today}T00:00:00.000Z`) },
  });
  for (const ins of adInsights) {
    if (frequencyHigh(num(ins.frequency), freqThreshold)) {
      out.push({
        code: 'A09',
        objectType: 'ad',
        objectMetaId: ins.objectMetaId,
        detail: `Фреквенција ${ins.frequency}.`,
      });
    }
  }

  return out;
}

/** Евалуирај + помири ги алертите за сите Meta клиенти. */
export async function evaluateAlerts() {
  const clients = await prisma.client.findMany({
    where: { usesMetaAds: true, archivedAt: null, metaAdAccountId: { not: null } },
  });

  let created = 0;
  let resolved = 0;

  for (const client of clients) {
    const freqThreshold = Number(client.metaFreqThreshold ?? 3);
    const firing = await firingForClient(client.id, freqThreshold);
    const firingKeys = new Set(firing.map((f) => alertDedupeKey(f.code, f.objectMetaId)));

    for (const f of firing) {
      const meta = ALERT_CATALOG[f.code];
      const dedupeKey = alertDedupeKey(f.code, f.objectMetaId);
      const existing = await prisma.metaAlert.findUnique({ where: { dedupeKey } });
      if (!existing) {
        await prisma.metaAlert.create({
          data: {
            clientId: client.id,
            code: f.code,
            severity: meta.severity as MetaAlertSeverity,
            objectType: f.objectType,
            objectMetaId: f.objectMetaId,
            title: meta.title,
            detail: f.detail,
            deepLink: { view: 'metaClient', clientId: client.id } as Prisma.InputJsonValue,
            state: 'new',
            dedupeKey,
          },
        });
        created++;
      } else {
        await prisma.metaAlert.update({
          where: { id: existing.id },
          data: {
            lastSeenAt: new Date(),
            detail: f.detail,
            occurrences: { increment: 1 },
            // ако бил решен а условот пак гори → реактивирај
            state: existing.state === 'resolved' ? 'new' : existing.state,
          },
        });
      }
    }

    // Авто-resolve: активни алерти чиј услов повеќе не гори
    const active = await prisma.metaAlert.findMany({
      where: { clientId: client.id, state: { in: ['new', 'seen', 'snoozed'] } },
    });
    for (const a of active) {
      if (!firingKeys.has(a.dedupeKey)) {
        await prisma.metaAlert.update({ where: { id: a.id }, data: { state: 'resolved' } });
        resolved++;
      }
    }
  }

  return { clients: clients.length, created, resolved };
}
