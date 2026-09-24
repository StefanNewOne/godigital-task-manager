import { prisma } from '../db/tenantExtension.js';

export interface AnalyticsKpis {
  reach: number;
  impressions: number;
  views: number;
  engagement: number;
  spend: number;
  cpr: number | null;
  ctr: number | null;
  posts: number;
}

export interface AnalyticsCampaign {
  id: string;
  name: string;
  color: string;
  periodFrom: string;
  periodTo: string;
  spent: number;
  budget: number;
  reach: number;
  cpr: number | null;
}

export interface AnalyticsPost {
  publicationId: string;
  name: string;
  color: string;
  platform: string;
  paid: boolean;
  reach: number;
  engagement: number;
  /** Стапка на ангажман (%) = engagement / reach. */
  rate: number | null;
}

export interface AnalyticsSplit {
  organicReach: number;
  paidReach: number;
  organicPosts: number;
  paidPosts: number;
}

export interface AnalyticsData {
  month: string;
  kpis: AnalyticsKpis;
  split: AnalyticsSplit;
  campaigns: AnalyticsCampaign[];
  topPosts: AnalyticsPost[];
  /** false = нема снимени метрики за месецот (екранот прикажува празна состојба). */
  hasData: boolean;
}

const num = (d: unknown): number => (d == null ? 0 : Number(d));

function monthRange(month: string): { start: Date; end: Date } {
  const [y, m] = month.split('-').map(Number);
  return { start: new Date(Date.UTC(y!, m! - 1, 1)), end: new Date(Date.UTC(y!, m!, 1)) };
}

/**
 * Аналитика по месец (PRD §4.7, Handoff §9): агрегира го НАЈНОВИОТ `MetricSnapshot` по објава
 * и по кампања. Органскиот досег/ангажман доаѓа од објавите; трошокот од кампањите. `cpr`
 * е spend-пондериран просек на кампањите, `ctr` impression-пондериран просек на објавите.
 */
export async function getAnalytics(month: string): Promise<AnalyticsData> {
  // Објави во месецот = task.group.monthKey === month.
  const pubs = await prisma.publication.findMany({
    where: { task: { group: { monthKey: month } } },
    include: {
      task: { include: { client: { select: { name: true, color: true } } } },
      promotion: { select: { decision: true } },
    },
  });
  const pubIds = pubs.map((p) => p.id);

  const pubSnaps = pubIds.length
    ? await prisma.metricSnapshot.findMany({
        where: { publicationId: { in: pubIds } },
        orderBy: { capturedAt: 'desc' },
        distinct: ['publicationId'],
      })
    : [];
  const byPub = new Map(pubSnaps.map((s) => [s.publicationId, s]));

  let reach = 0;
  let impressions = 0;
  let views = 0;
  let engagement = 0;
  let ctrWeighted = 0; // Σ(ctr · impressions)
  const split: AnalyticsSplit = { organicReach: 0, paidReach: 0, organicPosts: 0, paidPosts: 0 };
  const posts: AnalyticsPost[] = [];

  for (const p of pubs) {
    const s = byPub.get(p.id);
    if (!s) continue;
    const pReach = num(s.reach);
    const pImp = num(s.impressions);
    const pEng = num(s.engagement);
    const paid = p.promotion?.decision === 'paid';
    reach += pReach;
    impressions += pImp;
    views += num(s.views);
    engagement += pEng;
    if (s.ctr != null) ctrWeighted += num(s.ctr) * pImp;
    if (paid) {
      split.paidReach += pReach;
      split.paidPosts++;
    } else {
      split.organicReach += pReach;
      split.organicPosts++;
    }
    posts.push({
      publicationId: p.id,
      name: `${p.task.client.name} · ${p.task.title}`,
      color: p.task.client.color,
      platform: p.platform,
      paid,
      reach: pReach,
      engagement: pEng,
      rate: pReach > 0 ? Math.round((pEng / pReach) * 1000) / 10 : null,
    });
  }

  // Кампањи што се преклопуваат со месецот.
  const { start, end } = monthRange(month);
  const campaignRows = await prisma.campaign.findMany({
    where: { periodFrom: { lt: end }, periodTo: { gte: start } },
    include: { client: { select: { color: true } } },
  });
  const campIds = campaignRows.map((c) => c.id);
  const campSnaps = campIds.length
    ? await prisma.metricSnapshot.findMany({
        where: { campaignId: { in: campIds } },
        orderBy: { capturedAt: 'desc' },
        distinct: ['campaignId'],
      })
    : [];
  const byCamp = new Map(campSnaps.map((s) => [s.campaignId, s]));

  let spend = 0;
  let cprWeighted = 0; // Σ(cpr · spend)
  const campaigns: AnalyticsCampaign[] = campaignRows.map((c) => {
    const s = byCamp.get(c.id);
    const cSpend = num(s?.spend);
    spend += cSpend;
    if (s?.cpr != null) cprWeighted += num(s.cpr) * cSpend;
    return {
      id: c.id,
      name: c.name,
      color: c.client.color,
      periodFrom: c.periodFrom.toISOString(),
      periodTo: c.periodTo.toISOString(),
      spent: cSpend,
      budget: num(c.budget),
      reach: num(s?.reach),
      cpr: s?.cpr != null ? num(s.cpr) : null,
    };
  });

  const kpis: AnalyticsKpis = {
    reach,
    impressions,
    views,
    engagement,
    spend,
    cpr: spend > 0 ? Math.round((cprWeighted / spend) * 10000) / 10000 : null,
    ctr: impressions > 0 ? Math.round((ctrWeighted / impressions) * 10000) / 10000 : null,
    posts: posts.length,
  };

  posts.sort((a, b) => b.reach - a.reach);

  return {
    month,
    kpis,
    split,
    campaigns,
    topPosts: posts.slice(0, 8),
    hasData: posts.length > 0 || spend > 0,
  };
}
