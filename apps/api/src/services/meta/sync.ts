import { metaObjectiveToKey } from '@gd/core';
import type { MetaAccessLevel, ObjectiveKey as DbObjectiveKey, Prisma } from '@gd/db';
import { prisma } from '../../db/tenantExtension.js';
import { getMetaClient } from './metaClient.js';

/**
 * Модул 3 · Мета — синхронизација (само читање) на огледалото од Meta.
 * Не пишува ништо кон Meta. Ги полни MetaConnection/Campaign/AdSet/Ad/InsightDaily од
 * `MetaClient` (stub во dev/тест, graph во прод). Повикано од cron (§7).
 */

/** Partner задачи → ниво на пристап (Manage → write, View/Analyze → read). */
function accessOf(tasks: string[]): MetaAccessLevel {
  const t = tasks.map((x) => x.toUpperCase());
  if (t.includes('MANAGE') || t.includes('ADVERTISE')) return 'write';
  if (t.includes('ANALYZE')) return 'read';
  return 'none';
}

const ymd = (d: string): Date => new Date(`${d.slice(0, 10)}T00:00:00.000Z`);

/** Активни клиенти со Meta реклами + рекламен акаунт. */
async function metaClients() {
  return prisma.client.findMany({
    where: { usesMetaAds: true, archivedAt: null, metaAdAccountId: { not: null } },
  });
}

/** Sync на поврзувања: рекламен акаунт (детали) + страница + IG сметка по клиент. */
export async function syncConnections() {
  const meta = getMetaClient();
  const detailed = await meta.listAdAccountsDetailed();
  const byId = new Map(detailed.map((a) => [a.id, a]));
  const clients = await metaClients();
  let count = 0;

  for (const c of clients) {
    const acct = byId.get(c.metaAdAccountId!);
    await prisma.metaConnection.upsert({
      where: {
        clientId_kind_metaId: { clientId: c.id, kind: 'adAccount', metaId: c.metaAdAccountId! },
      },
      create: {
        clientId: c.id,
        kind: 'adAccount',
        metaId: c.metaAdAccountId!,
        name: acct?.name ?? null,
        currency: acct?.currency ?? null,
        accessLevel: acct ? accessOf(acct.userTasks) : 'read',
        spendCap: acct?.spendCap ?? null,
        amountSpent: acct?.amountSpent ?? null,
        accountStatus: acct?.accountStatus ?? null,
        disableReason: acct?.disableReason ?? null,
        lastSyncAt: new Date(),
      },
      update: {
        name: acct?.name ?? null,
        currency: acct?.currency ?? null,
        accessLevel: acct ? accessOf(acct.userTasks) : 'read',
        spendCap: acct?.spendCap ?? null,
        amountSpent: acct?.amountSpent ?? null,
        accountStatus: acct?.accountStatus ?? null,
        disableReason: acct?.disableReason ?? null,
        lastSyncAt: new Date(),
        lastSyncError: null,
        syncFailCount: 0,
      },
    });
    count++;

    for (const [kind, metaId] of [
      ['page', c.metaPageId],
      ['igAccount', c.metaIgId],
    ] as const) {
      if (!metaId) continue;
      await prisma.metaConnection.upsert({
        where: { clientId_kind_metaId: { clientId: c.id, kind, metaId } },
        create: { clientId: c.id, kind, metaId, lastSyncAt: new Date() },
        update: { lastSyncAt: new Date() },
      });
    }
  }
  return { clients: count };
}

/** Sync на структурата (кампањи→ad sets→ads) за еден клиент. */
export async function syncStructureForClient(clientId: string) {
  const conn = await prisma.metaConnection.findFirst({
    where: { clientId, kind: 'adAccount' },
  });
  if (!conn) return { campaigns: 0, adsets: 0, ads: 0 };

  const meta = getMetaClient();
  const s = await meta.fetchStructure(conn.metaId);

  const campIdByMeta = new Map<string, string>();
  for (const c of s.campaigns) {
    const key = metaObjectiveToKey(c.objective);
    const row = await prisma.metaCampaign.upsert({
      where: { metaId: c.metaId },
      create: {
        clientId,
        connectionId: conn.id,
        metaId: c.metaId,
        name: c.name,
        objective: c.objective ?? 'UNKNOWN',
        objectiveKey: (key as DbObjectiveKey | null) ?? null,
        dailyBudget: c.dailyBudget ?? null,
        status: c.status,
        effectiveStatus: c.effectiveStatus,
        startTime: c.startTime ? new Date(c.startTime) : null,
        stopTime: c.stopTime ? new Date(c.stopTime) : null,
        raw: c.raw as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
      update: {
        name: c.name,
        objective: c.objective ?? 'UNKNOWN',
        objectiveKey: (key as DbObjectiveKey | null) ?? null,
        dailyBudget: c.dailyBudget ?? null,
        status: c.status,
        effectiveStatus: c.effectiveStatus,
        startTime: c.startTime ? new Date(c.startTime) : null,
        stopTime: c.stopTime ? new Date(c.stopTime) : null,
        raw: c.raw as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
    });
    campIdByMeta.set(c.metaId, row.id);
  }

  const adsetIdByMeta = new Map<string, string>();
  for (const a of s.adsets) {
    const campaignId = campIdByMeta.get(a.campaignMetaId);
    if (!campaignId) continue;
    const row = await prisma.metaAdSet.upsert({
      where: { metaId: a.metaId },
      create: {
        campaignId,
        metaId: a.metaId,
        name: a.name,
        status: a.status,
        effectiveStatus: a.effectiveStatus,
        optimizationGoal: a.optimizationGoal,
        learningStage: a.learningStage,
        raw: a.raw as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
      update: {
        name: a.name,
        status: a.status,
        effectiveStatus: a.effectiveStatus,
        optimizationGoal: a.optimizationGoal,
        learningStage: a.learningStage,
        raw: a.raw as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
    });
    adsetIdByMeta.set(a.metaId, row.id);
  }

  let adCount = 0;
  for (const ad of s.ads) {
    const adSetId = adsetIdByMeta.get(ad.adSetMetaId);
    if (!adSetId) continue;
    await prisma.metaAd.upsert({
      where: { metaId: ad.metaId },
      create: {
        adSetId,
        metaId: ad.metaId,
        name: ad.name,
        status: ad.status,
        effectiveStatus: ad.effectiveStatus,
        reviewStatus: ad.reviewStatus,
        sourcePostMetaId: ad.sourcePostMetaId,
        raw: ad.raw as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
      update: {
        name: ad.name,
        status: ad.status,
        effectiveStatus: ad.effectiveStatus,
        reviewStatus: ad.reviewStatus,
        sourcePostMetaId: ad.sourcePostMetaId,
        raw: ad.raw as Prisma.InputJsonValue,
        syncedAt: new Date(),
      },
    });
    adCount++;
  }

  return { campaigns: s.campaigns.length, adsets: adsetIdByMeta.size, ads: adCount };
}

/** Sync на дневни insights (3 нивоа) за клиент за даден датум (default: денес). */
export async function syncInsightsForClient(clientId: string, date: string, isFinal = false) {
  const conn = await prisma.metaConnection.findFirst({
    where: { clientId, kind: 'adAccount' },
  });
  if (!conn) return { rows: 0 };

  const meta = getMetaClient();
  let rows = 0;
  for (const level of ['campaign', 'adset', 'ad'] as const) {
    const insights = await meta.fetchInsightsDaily(conn.metaId, level, date, date);
    for (const r of insights) {
      if (!r.objectMetaId) continue;
      await prisma.metaInsightDaily.upsert({
        where: {
          level_objectMetaId_date: { level, objectMetaId: r.objectMetaId, date: ymd(r.date) },
        },
        create: {
          level,
          objectMetaId: r.objectMetaId,
          clientId,
          date: ymd(r.date),
          spend: r.spend,
          impressions: r.impressions,
          reach: r.reach,
          frequency: r.frequency,
          clicks: r.clicks,
          ctr: r.ctr,
          results: r.results,
          resultType: r.resultType,
          actions: r.actions as Prisma.InputJsonValue,
          isFinal,
        },
        update: {
          spend: r.spend,
          impressions: r.impressions,
          reach: r.reach,
          frequency: r.frequency,
          clicks: r.clicks,
          ctr: r.ctr,
          results: r.results,
          resultType: r.resultType,
          actions: r.actions as Prisma.InputJsonValue,
          isFinal,
          fetchedAt: new Date(),
        },
      });
      rows++;
    }
  }
  return { rows };
}

/** Ажурирај account-ниво податоци (spend cap, статус) за сите клиенти. */
export async function syncAccounts() {
  const meta = getMetaClient();
  const detailed = await meta.listAdAccountsDetailed();
  const byId = new Map(detailed.map((a) => [a.id, a]));
  const conns = await prisma.metaConnection.findMany({ where: { kind: 'adAccount' } });
  let count = 0;
  for (const conn of conns) {
    const acct = byId.get(conn.metaId);
    if (!acct) continue;
    await prisma.metaConnection.update({
      where: { id: conn.id },
      data: {
        spendCap: acct.spendCap ?? null,
        amountSpent: acct.amountSpent ?? null,
        accountStatus: acct.accountStatus ?? null,
        disableReason: acct.disableReason ?? null,
        currency: acct.currency ?? conn.currency,
        lastSyncAt: new Date(),
      },
    });
    count++;
  }
  return { accounts: count };
}

const todayUtc = (): string => new Date().toISOString().slice(0, 10);

/** Оркестратори за cron (сите активни Meta клиенти). */
export async function syncAllStructure() {
  const clients = await metaClients();
  let campaigns = 0;
  for (const c of clients) {
    const r = await syncStructureForClient(c.id);
    campaigns += r.campaigns;
  }
  return { clients: clients.length, campaigns };
}

export async function syncAllInsightsToday() {
  const clients = await metaClients();
  const date = todayUtc();
  let rows = 0;
  for (const c of clients) {
    const r = await syncInsightsForClient(c.id, date, false);
    rows += r.rows;
  }
  return { clients: clients.length, rows };
}
