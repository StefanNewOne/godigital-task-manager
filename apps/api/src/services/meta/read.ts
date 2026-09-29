import {
  canAggregate,
  costPerResult,
  objectiveMeta,
  type AlertSeverity,
  type ObjectiveKey,
} from '@gd/core';
import type { MetaAlertState, Prisma } from '@gd/db';
import { prisma } from '../../db/tenantExtension.js';
import { AppError } from '../../lib/errors.js';

/**
 * Модул 3 · Мета — read слој за екраните (Утрински преглед, Клиенти, Пресек, Клиент·Реклами).
 * Само чита од огледалото; нема повици кон Meta овде (тоа е sync). §14.
 */

const dayMs = 24 * 3600 * 1000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Опсег на период: 7/30 дена или тековен месец. */
export function periodRange(period: string): { from: Date; to: Date } {
  const to = new Date();
  if (period === 'month') {
    const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));
    return { from, to };
  }
  const days = period === '30' ? 30 : 7;
  return { from: new Date(to.getTime() - days * dayMs), to };
}

const n = (v: unknown): number => (v == null ? 0 : Number(v));

/** Утрински преглед: отворени алерти по сериозност, sync статус, KPI. */
export async function metaOverview() {
  const alerts = await prisma.metaAlert.findMany({
    where: { state: { in: ['new', 'seen'] } },
    select: { severity: true },
  });
  const bySeverity: Record<AlertSeverity, number> = { crit: 0, high: 0, mid: 0, info: 0 };
  for (const a of alerts) bySeverity[a.severity as AlertSeverity]++;

  const conns = await prisma.metaConnection.findMany({
    where: { kind: 'adAccount' },
    select: { lastSyncAt: true, accessLevel: true, syncFailCount: true },
  });
  const lastSync = conns.reduce<Date | null>(
    (acc, c) => (c.lastSyncAt && (!acc || c.lastSyncAt > acc) ? c.lastSyncAt : acc),
    null,
  );

  const today = iso(new Date());
  const todaySpend = await prisma.metaInsightDaily.aggregate({
    where: { level: 'campaign', date: new Date(`${today}T00:00:00.000Z`) },
    _sum: { spend: true },
  });
  const activeCampaigns = await prisma.metaCampaign.count({ where: { effectiveStatus: 'ACTIVE' } });

  return {
    alerts: { total: alerts.length, ...bySeverity },
    sync: {
      lastSyncAt: lastSync,
      accounts: conns.length,
      failing: conns.filter((c) => c.syncFailCount > 0).length,
      readOnly: conns.filter((c) => c.accessLevel === 'read').length,
    },
    kpi: { activeCampaigns, todaySpend: n(todaySpend._sum.spend) },
  };
}

/** Листа алерти (со филтри), сортирани по сериозност (crit прв) + последно виден. */
export async function listMetaAlerts(opts: {
  state?: string;
  severity?: string;
  clientId?: string;
}) {
  const where: Prisma.MetaAlertWhereInput = {};
  if (opts.clientId) where.clientId = opts.clientId;
  if (opts.state) where.state = opts.state as MetaAlertState;
  else where.state = { in: ['new', 'seen', 'snoozed'] };
  if (opts.severity) where.severity = opts.severity as AlertSeverity;
  const rows = await prisma.metaAlert.findMany({ where, orderBy: [{ lastSeenAt: 'desc' }] });
  const order: Record<string, number> = { crit: 0, high: 1, mid: 2, info: 3 };
  return rows.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
}

/** Промени состојба на алерт (видено / одложи). */
export async function setAlertState(id: string, state: MetaAlertState, snoozedUntil?: Date | null) {
  const alert = await prisma.metaAlert.findUnique({ where: { id } });
  if (!alert) throw new AppError('NOT_FOUND', 'Алертот не е пронајден.', 404);
  return prisma.metaAlert.update({
    where: { id },
    data: { state, snoozedUntil: state === 'snoozed' ? (snoozedUntil ?? null) : null },
  });
}

/** Ред по клиент: цел, кампањи, алерти, последна промена. */
export async function metaClientsRows() {
  const clients = await prisma.client.findMany({
    where: { usesMetaAds: true, archivedAt: null },
    select: {
      id: true,
      name: true,
      color: true,
      metaTargetText: true,
      metaAdAccountId: true,
    },
  });
  const rows = [];
  for (const c of clients) {
    const [campaigns, alerts, conn] = await Promise.all([
      prisma.metaCampaign.count({ where: { clientId: c.id } }),
      prisma.metaAlert.count({ where: { clientId: c.id, state: { in: ['new', 'seen'] } } }),
      prisma.metaConnection.findFirst({
        where: { clientId: c.id, kind: 'adAccount' },
        select: { lastSyncAt: true, currency: true, accessLevel: true },
      }),
    ]);
    rows.push({
      id: c.id,
      name: c.name,
      color: c.color,
      target: c.metaTargetText,
      campaigns,
      alerts,
      currency: conn?.currency ?? null,
      accessLevel: conn?.accessLevel ?? null,
      lastSyncAt: conn?.lastSyncAt ?? null,
    });
  }
  return rows;
}

/** Пресек низ клиенти по кампања за период — групиран по Objective (никогаш собран меѓу Objective). */
export async function metaCross(period: string) {
  const { from, to } = periodRange(period);
  const campaigns = await prisma.metaCampaign.findMany({
    select: { metaId: true, name: true, clientId: true, objectiveKey: true, objective: true },
  });
  const rows = [];
  for (const c of campaigns) {
    const agg = await prisma.metaInsightDaily.aggregate({
      where: {
        level: 'campaign',
        objectMetaId: c.metaId,
        date: {
          gte: new Date(`${iso(from)}T00:00:00.000Z`),
          lte: new Date(`${iso(to)}T00:00:00.000Z`),
        },
      },
      _sum: { spend: true, results: true, reach: true },
    });
    const spend = n(agg._sum.spend);
    const results = n(agg._sum.results);
    const key = (c.objectiveKey as ObjectiveKey | null) ?? null;
    rows.push({
      campaignMetaId: c.metaId,
      name: c.name,
      clientId: c.clientId,
      objectiveKey: key,
      objectiveLabel: key ? objectiveMeta(key).objective : c.objective,
      resultLabel: key ? objectiveMeta(key).resultLabel : 'Резултати',
      costLabel: key ? objectiveMeta(key).costLabel : 'Цена по резултат',
      spend,
      results,
      cpr: costPerResult(spend, results),
    });
  }
  // Групи по Objective (за да не се собираат различни Objective).
  const groups = new Map<string, typeof rows>();
  for (const r of rows) {
    const gk = r.objectiveKey ?? 'unknown';
    (groups.get(gk) ?? groups.set(gk, []).get(gk)!).push(r);
  }
  return {
    period,
    from: iso(from),
    to: iso(to),
    groups: [...groups.entries()].map(([objectiveKey, items]) => ({
      objectiveKey,
      objectiveLabel: items[0]?.objectiveLabel ?? 'Непознат Objective',
      // Збир е дозволен само во иста група (ист Objective).
      aggregatable: canAggregate(
        items.map((i) => i.objectiveKey).filter((k): k is ObjectiveKey => !!k),
      ),
      spend: items.reduce((s, i) => s + i.spend, 0),
      results: items.reduce((s, i) => s + i.results, 0),
      items,
    })),
  };
}

/** Структура на клиент: кампањи → ad sets → ads + KPI по Objective за период. */
export async function metaClientStructure(clientId: string, period: string) {
  const { from, to } = periodRange(period);
  const dateFilter = {
    gte: new Date(`${iso(from)}T00:00:00.000Z`),
    lte: new Date(`${iso(to)}T00:00:00.000Z`),
  };
  const insightFor = async (level: 'campaign' | 'adset' | 'ad', objectMetaId: string) => {
    const agg = await prisma.metaInsightDaily.aggregate({
      where: { level, objectMetaId, date: dateFilter },
      _sum: { spend: true, results: true, reach: true, impressions: true },
    });
    const spend = n(agg._sum.spend);
    const results = n(agg._sum.results);
    return { spend, results, reach: n(agg._sum.reach), cpr: costPerResult(spend, results) };
  };

  const campaigns = await prisma.metaCampaign.findMany({
    where: { clientId },
    include: { adSets: { include: { ads: true } } },
  });

  const out = [];
  for (const c of campaigns) {
    const key = (c.objectiveKey as ObjectiveKey | null) ?? null;
    out.push({
      metaId: c.metaId,
      name: c.name,
      objectiveKey: key,
      objectiveLabel: key ? objectiveMeta(key).objective : c.objective,
      resultLabel: key ? objectiveMeta(key).resultLabel : 'Резултати',
      status: c.status,
      effectiveStatus: c.effectiveStatus,
      dailyBudget: c.dailyBudget != null ? Number(c.dailyBudget) : null,
      kpi: await insightFor('campaign', c.metaId),
      adSets: await Promise.all(
        c.adSets.map(async (s) => ({
          metaId: s.metaId,
          name: s.name,
          status: s.status,
          effectiveStatus: s.effectiveStatus,
          learningStage: s.learningStage,
          kpi: await insightFor('adset', s.metaId),
          ads: await Promise.all(
            s.ads.map(async (ad) => ({
              metaId: ad.metaId,
              name: ad.name,
              status: ad.status,
              effectiveStatus: ad.effectiveStatus,
              reviewStatus: ad.reviewStatus,
              publicationId: ad.publicationId,
              kpi: await insightFor('ad', ad.metaId),
            })),
          ),
        })),
      ),
    });
  }
  return { clientId, period, from: iso(from), to: iso(to), campaigns: out };
}
