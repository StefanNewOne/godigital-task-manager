import { costPerResult, type ObjectiveKey } from '@gd/core';
import { prisma } from '../../db/tenantExtension.js';
import { AppError } from '../../lib/errors.js';

/**
 * Модул 3 · Мета — метрики во таскот (META_TECH_SPEC §9.1). Само чита од огледалото + MetricSnapshot;
 * живите бројки заменуваат статичен блок во зоната Аналитика. Изворот е еден (истите бројки во
 * Мета·Органика/Реклами и во таскот).
 */
const n = (v: unknown): number => (v == null ? 0 : Number(v));
const days7ago = () => new Date(Date.now() - 7 * 24 * 3600 * 1000);

export async function getTaskMeta(taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) throw new AppError('NOT_FOUND', 'Таскот не е пронајден.', 404);

  const pub = await prisma.publication.findFirst({ where: { taskId } });
  if (!pub) {
    return {
      publication: null,
      organic: null,
      fbPerPostUnavailable: false,
      paid: [],
      plans: [],
      promotion: null,
      freshness: { organicAt: null, paidAt: null, paidIsFinal: true },
    };
  }

  // Органика — последен MetricSnapshot за објавата.
  const snap = await prisma.metricSnapshot.findFirst({
    where: { publicationId: pub.id },
    orderBy: { capturedAt: 'desc' },
  });
  const organic = snap
    ? {
        views: n(snap.views),
        reach: pub.platform === 'fb' ? null : n(snap.reach),
        engagement: n(snap.engagement),
        capturedAt: snap.capturedAt,
      }
    : null;

  // Платено — реклами што ја користат објавата, збир од MetaInsightDaily по реклама.
  const ads = await prisma.metaAd.findMany({
    where: { publicationId: pub.id },
    include: { adSet: { include: { campaign: true } } },
  });
  const paid = [];
  let latestPaidAt: Date | null = null;
  let paidIsFinal = true;
  for (const ad of ads) {
    const camp = ad.adSet.campaign;
    const conn = await prisma.metaConnection.findUnique({ where: { id: camp.connectionId } });
    const agg = await prisma.metaInsightDaily.aggregate({
      where: { level: 'ad', objectMetaId: ad.metaId },
      _sum: { spend: true, results: true },
      _max: { fetchedAt: true },
    });
    const spend = n(agg._sum.spend);
    const results = n(agg._sum.results);
    // Дали има податоци од последните 7 дена (кои не се конечни).
    const recent = await prisma.metaInsightDaily.count({
      where: { level: 'ad', objectMetaId: ad.metaId, date: { gte: days7ago() }, isFinal: false },
    });
    if (recent > 0) paidIsFinal = false;
    if (agg._max.fetchedAt && (!latestPaidAt || agg._max.fetchedAt > latestPaidAt)) {
      latestPaidAt = agg._max.fetchedAt;
    }
    paid.push({
      adId: ad.metaId,
      adName: ad.name,
      campaignName: camp.name,
      adSetName: ad.adSet.name,
      objectiveKey: (camp.objectiveKey as ObjectiveKey | null) ?? null,
      results,
      spend,
      currency: conn?.currency ?? null,
      cpr: costPerResult(spend, results),
      status: ad.effectiveStatus,
      reviewStatus: ad.reviewStatus,
    });
  }

  const plans = await prisma.metaChangePlan.findMany({
    where: { taskId },
    select: { id: true, status: true, op: true },
  });
  const promo = await prisma.promotion.findUnique({ where: { publicationId: pub.id } });

  return {
    publication: {
      platform: pub.platform,
      postType: pub.postType,
      publishedAt: pub.publishedAt,
      metaMediaId: pub.metaMediaId,
      resolveStatus: pub.resolveStatus,
    },
    organic,
    fbPerPostUnavailable: pub.platform === 'fb',
    paid,
    plans,
    promotion: promo ? { decision: promo.decision, campaignId: promo.campaignId } : null,
    freshness: { organicAt: snap?.capturedAt ?? null, paidAt: latestPaidAt, paidIsFinal },
  };
}

/**
 * Линкувај реклами кон објави: MetaAd.sourcePostMetaId == Publication.metaMediaId (ист клиент).
 * Повикано по structure sync. §9: врската е преку publicationId или sourcePostMetaId=metaMediaId.
 */
export async function linkAdsToPublications(clientId: string) {
  const ads = await prisma.metaAd.findMany({
    where: {
      adSet: { campaign: { clientId } },
      publicationId: null,
      sourcePostMetaId: { not: null },
    },
    select: { id: true, sourcePostMetaId: true },
  });
  let linked = 0;
  for (const ad of ads) {
    const pub = await prisma.publication.findFirst({
      where: { clientId, metaMediaId: ad.sourcePostMetaId },
      select: { id: true },
    });
    if (pub) {
      await prisma.metaAd.update({ where: { id: ad.id }, data: { publicationId: pub.id } });
      linked++;
    }
  }
  return linked;
}
