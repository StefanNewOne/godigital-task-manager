import type { Prisma, PostType } from '@gd/db';
import { deriveMetrics, normalizeMetaInsights, type NormalizedMetrics } from '@gd/core';
import { prisma } from '../../db/tenantExtension.js';
import { AppError } from '../../lib/errors.js';
import { getMetaClient } from './metaClient.js';

/** IG media_type → наш PostType (за backfill-ирани објави). */
function postTypeOf(mediaType: string | null): PostType {
  if (mediaType === 'VIDEO') return 'reel';
  if (mediaType === 'CAROUSEL_ALBUM') return 'carousel';
  return 'post';
}

/** Само колонските метрики од `MetricSnapshot` (останатите полиња на core се помошни). */
function metricColumns(m: NormalizedMetrics) {
  return {
    reach: m.reach ?? null,
    impressions: m.impressions ?? null,
    views: m.views ?? null,
    engagement: m.engagement ?? null,
    spend: m.spend ?? null,
    cpr: m.cpr ?? null,
    ctr: m.ctr ?? null,
    frequency: m.frequency ?? null,
  };
}

/**
 * Резолвирај `metaMediaId` за објави со `externalRef` но сè уште без media id (PRD §4.8).
 * Идемпотентно — резолвираните се прескокнуваат. Best-effort по објава.
 */
export async function resolvePublications() {
  const client = getMetaClient();
  const pending = await prisma.publication.findMany({
    where: {
      metaMediaId: null,
      externalRef: { not: null },
      resolveStatus: { in: ['pending', 'failed'] },
    },
    include: {
      task: { include: { client: { select: { metaIgId: true } } } },
      client: { select: { metaIgId: true } },
    },
  });
  let resolved = 0;
  let failed = 0;
  for (const p of pending) {
    const igId = p.task?.client?.metaIgId ?? p.client?.metaIgId ?? null;
    const mediaId = await client.resolveMediaId({
      platform: p.platform,
      externalRef: p.externalRef,
      permalink: p.permalink,
      igId,
    });
    if (mediaId) {
      await prisma.publication.update({
        where: { id: p.id },
        data: { metaMediaId: mediaId, resolveStatus: 'resolved' },
      });
      resolved++;
    } else {
      await prisma.publication.update({ where: { id: p.id }, data: { resolveStatus: 'failed' } });
      failed++;
    }
  }
  return { resolved, failed };
}

/**
 * Влечи метрики за објави со резолвиран media id + активни кампањи → **append** `MetricSnapshot`
 * (append-only време-серија, §И6). Best-effort по објект: една грешка не го паѓа целиот пул.
 */
export async function pullMetrics(opts: { mediaOnly?: boolean } = {}) {
  const client = getMetaClient();
  let snapshots = 0;
  let errors = 0;

  const pubs = await prisma.publication.findMany({ where: { metaMediaId: { not: null } } });
  for (const p of pubs) {
    try {
      const raw = await client.fetchMediaInsights({
        platform: p.platform,
        mediaId: p.metaMediaId!,
      });
      const m = deriveMetrics(normalizeMetaInsights(raw));
      await prisma.metricSnapshot.create({
        data: { publicationId: p.id, raw: raw as Prisma.InputJsonValue, ...metricColumns(m) },
      });
      snapshots++;
    } catch {
      errors++;
    }
  }

  // Кампањите се прескокнуваат кога `mediaOnly` (backfill веќе ги снима сите статуси).
  const campaigns = opts.mediaOnly
    ? []
    : await prisma.campaign.findMany({
        where: { status: 'active', metaCampaignId: { not: null } },
      });
  for (const c of campaigns) {
    try {
      const raw = await client.fetchAdInsights({ metaCampaignId: c.metaCampaignId! });
      const m = deriveMetrics(normalizeMetaInsights(raw));
      await prisma.metricSnapshot.create({
        data: { campaignId: c.id, raw: raw as Prisma.InputJsonValue, ...metricColumns(m) },
      });
      snapshots++;
    } catch {
      errors++;
    }
  }

  return { snapshots, errors };
}

/**
 * Backfill (B2): повлечи ги последните `limit` постови директно од IG-сметката на клиентот и
 * материјализирај account-ниво `Publication` (без таск, со clientId + resolved media id).
 * Идемпотентно по (clientId, platform, externalRef). Потоа `pullMetrics` ги покрива.
 */
export async function backfillClientMedia(clientId: string, limit = 25) {
  const clientRow = await prisma.client.findUnique({ where: { id: clientId } });
  if (!clientRow) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);
  if (!clientRow.metaIgId) {
    throw new AppError(
      'VALIDATION_FAILED',
      'Клиентот нема поврзана Instagram сметка (metaIgId).',
      400,
    );
  }

  const client = getMetaClient();
  const media = await client.fetchAccountMedia(clientRow.metaIgId, limit);
  let created = 0;
  let updated = 0;
  for (const m of media) {
    const externalRef = m.shortcode ?? m.mediaId;
    const existing = await prisma.publication.findFirst({
      where: { clientId, platform: 'ig', externalRef, taskId: null },
    });
    const data = {
      permalink: m.permalink,
      metaMediaId: m.mediaId,
      resolveStatus: 'resolved' as const,
      postType: postTypeOf(m.mediaType),
      publishedAt: m.timestamp ? new Date(m.timestamp) : null,
    };
    if (existing) {
      await prisma.publication.update({ where: { id: existing.id }, data });
      updated++;
    } else {
      await prisma.publication.create({
        data: { clientId, platform: 'ig', externalRef, ...data },
      });
      created++;
    }
  }
  return { created, updated, total: media.length };
}

/**
 * Backfill (B2): FB page-ниво метрики → append `PageSnapshot`. Reach е укинат од Meta (v21),
 * па се снимаат достапните (followers, ангажман, page views, нови follows, video views, реакции).
 */
export async function backfillClientPage(clientId: string) {
  const clientRow = await prisma.client.findUnique({ where: { id: clientId } });
  if (!clientRow) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);
  if (!clientRow.metaPageId) return { captured: false };

  const pm = await getMetaClient().fetchPageMetrics(clientRow.metaPageId);
  await prisma.pageSnapshot.create({
    data: {
      clientId,
      followers: pm.followers,
      engagement: pm.engagement,
      pageViews: pm.pageViews,
      newFollows: pm.newFollows,
      videoViews: pm.videoViews,
      reactions: pm.reactions,
      raw: pm.raw as Prisma.InputJsonValue,
    },
  });
  return { captured: true, followers: pm.followers };
}

/** FB статус на кампања → наш CampaignStatus. */
function campaignStatusOf(status: string | null): 'planned' | 'active' | 'closed' {
  if (status === 'ACTIVE') return 'active';
  if (status === 'PAUSED' || status === 'IN_PROCESS' || status === 'WITH_ISSUES') return 'planned';
  return 'closed';
}

/**
 * Backfill (B2 платено): повлечи ги кампањите од рекламната сметка на клиентот + нивните insights
 * → upsert `Campaign` + `MetricSnapshot` (spend/reach/impressions/ctr). Идемпотентно по
 * (clientId, metaCampaignId).
 */
export async function backfillClientCampaigns(clientId: string, limit = 50) {
  const clientRow = await prisma.client.findUnique({ where: { id: clientId } });
  if (!clientRow) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);
  if (!clientRow.metaAdAccountId) {
    return { created: 0, updated: 0, total: 0, snapshots: 0 };
  }

  const client = getMetaClient();
  const list = await client.fetchCampaigns(clientRow.metaAdAccountId, limit);
  let created = 0;
  let updated = 0;
  let snapshots = 0;
  for (const c of list) {
    const from = c.startTime ? new Date(c.startTime) : new Date();
    const to = c.stopTime ? new Date(c.stopTime) : new Date();
    const base = {
      name: c.name,
      objective: c.objective ?? 'UNKNOWN',
      periodFrom: from,
      periodTo: to,
      status: campaignStatusOf(c.status),
    };
    const existing = await prisma.campaign.findFirst({
      where: { clientId, metaCampaignId: c.campaignId },
    });
    let campaign;
    if (existing) {
      campaign = await prisma.campaign.update({ where: { id: existing.id }, data: base });
      updated++;
    } else {
      campaign = await prisma.campaign.create({
        data: { clientId, metaCampaignId: c.campaignId, budget: 0, ...base },
      });
      created++;
    }

    try {
      const raw = await client.fetchAdInsights({ metaCampaignId: c.campaignId });
      const m = deriveMetrics(normalizeMetaInsights(raw));
      await prisma.metricSnapshot.create({
        data: { campaignId: campaign.id, raw: raw as Prisma.InputJsonValue, ...metricColumns(m) },
      });
      snapshots++;
    } catch {
      // best-effort по кампања
    }
  }
  return { created, updated, total: list.length, snapshots };
}
