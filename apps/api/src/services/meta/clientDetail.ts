import type { Prisma } from '@gd/db';
import { prisma } from '../../db/tenantExtension.js';
import { AppError } from '../../lib/errors.js';
import { recordEvent } from '../../lib/events.js';
import { periodRange } from './read.js';

/**
 * Модул 3 · Мета — MF2: „Мета · Клиент" детал (Профил + Органика). Само читање кон Meta (D1).
 * Табот „Реклами" го користи постоечкиот `metaClientStructure`.
 */

const num = (v: Prisma.Decimal | null | undefined): number => (v ? Number(v) : 0);

/** Заглавие + Профил на клиент (цели/прагови/белешки) + ниво на пристап од adAccount конекцијата. */
export async function metaClientProfile(clientId: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);
  const conn = await prisma.metaConnection.findFirst({
    where: { clientId, kind: 'adAccount' },
    select: { accessLevel: true, currency: true, metaId: true },
  });
  return {
    id: client.id,
    name: client.name,
    color: client.color,
    accessLevel: conn?.accessLevel ?? null,
    currency: conn?.currency ?? null,
    adAccountId: client.metaAdAccountId,
    pageId: client.metaPageId,
    igId: client.metaIgId,
    profile: {
      targetText: client.metaTargetText,
      targetValue: client.metaTargetValue ? Number(client.metaTargetValue) : null,
      targetMetric: client.metaTargetMetric,
      maxDailyBudget: client.metaMaxDailyBudget ? Number(client.metaMaxDailyBudget) : null,
      freqThreshold: Number(client.metaFreqThreshold),
      cprAlertPct: client.metaCprAlertPct,
      namingConvention: client.metaNamingConvention,
      notes: client.metaNotes,
    },
  };
}

export interface ProfileUpdate {
  targetText?: string | null;
  targetValue?: number | null;
  targetMetric?: string | null;
  maxDailyBudget?: number | null;
  freqThreshold?: number;
  cprAlertPct?: number;
  namingConvention?: string | null;
  notes?: string | null;
}

/** Ажурирај Профил (само Директор — рутата гати). Записот е EventLog (аудит). */
export async function updateMetaClientProfile(clientId: string, input: ProfileUpdate) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);
  return prisma.$transaction(async (tx) => {
    const updated = await tx.client.update({
      where: { id: clientId },
      data: {
        metaTargetText: input.targetText ?? undefined,
        metaTargetValue: input.targetValue ?? undefined,
        metaTargetMetric: input.targetMetric ?? undefined,
        metaMaxDailyBudget: input.maxDailyBudget ?? undefined,
        metaFreqThreshold: input.freqThreshold ?? undefined,
        metaCprAlertPct: input.cprAlertPct ?? undefined,
        metaNamingConvention: input.namingConvention ?? undefined,
        metaNotes: input.notes ?? undefined,
      },
    });
    await recordEvent(tx, {
      eventType: 'meta.profile.updated',
      objectType: 'client',
      objectId: clientId,
      clientId,
      narrative: `Ажуриран Мета профил на „${client.name}".`,
    });
    return updated;
  });
}

/**
 * Органски IG постови на клиент (§ таб „Органика"): најнов MetricSnapshot по објава во периодот,
 * KPI-збир + листа со thumbnail/метрики/„во реклама". Views ги заменува старите impressions (v26).
 */
export async function metaClientOrganic(clientId: string, period: string) {
  const { from, to } = periodRange(period);
  const pubs = await prisma.publication.findMany({
    where: {
      clientId,
      platform: 'ig',
      publishedAt: { gte: from, lte: to },
    },
    orderBy: { publishedAt: 'desc' },
    take: 200,
  });

  // Кои metaMediaId се искористени во реклама (sourcePostMetaId на MetaAd).
  const mediaIds = pubs.map((p) => p.metaMediaId).filter((x): x is string => !!x);
  const inAdRows = mediaIds.length
    ? await prisma.metaAd.findMany({
        where: { sourcePostMetaId: { in: mediaIds } },
        select: { sourcePostMetaId: true },
      })
    : [];
  const inAd = new Set(inAdRows.map((r) => r.sourcePostMetaId));

  const posts = await Promise.all(
    pubs.map(async (p) => {
      const snap = await prisma.metricSnapshot.findFirst({
        where: { publicationId: p.id },
        orderBy: { capturedAt: 'desc' },
      });
      return {
        id: p.id,
        taskId: p.taskId,
        mediaType: p.mediaType,
        caption: p.caption,
        thumbnailFileId: p.thumbnailFileId,
        permalink: p.permalink,
        publishedAt: p.publishedAt,
        inAd: !!p.metaMediaId && inAd.has(p.metaMediaId),
        reach: snap ? num(snap.reach) : null,
        views: snap ? num(snap.views) : null,
        engagement: snap ? num(snap.engagement) : null,
      };
    }),
  );

  const totals = posts.reduce(
    (acc, p) => ({
      posts: acc.posts + 1,
      reach: acc.reach + (p.reach ?? 0),
      views: acc.views + (p.views ?? 0),
      engagement: acc.engagement + (p.engagement ?? 0),
    }),
    { posts: 0, reach: 0, views: 0, engagement: 0 },
  );

  return { clientId, period, connected: !!(await hasIg(clientId)), totals, posts };
}

async function hasIg(clientId: string): Promise<boolean> {
  const c = await prisma.client.findUnique({ where: { id: clientId }, select: { metaIgId: true } });
  return !!c?.metaIgId;
}
