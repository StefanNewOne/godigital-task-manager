import type { Prisma } from '@gd/db';
import { deriveMetrics, normalizeMetaInsights, type NormalizedMetrics } from '@gd/core';
import { prisma } from '../../db/tenantExtension.js';
import { getMetaClient } from './metaClient.js';

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
  });
  let resolved = 0;
  let failed = 0;
  for (const p of pending) {
    const mediaId = await client.resolveMediaId({
      platform: p.platform,
      externalRef: p.externalRef,
      permalink: p.permalink,
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
export async function pullMetrics() {
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

  const campaigns = await prisma.campaign.findMany({
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
