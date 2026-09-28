import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { getMetaClient } from './meta/metaClient.js';

/**
 * Аналитика по КЛИЕНТ + ПЕРИОД, поделена по извор (Instagram · Facebook · Реклами) со разбивка
 * по месец. IG/FB од складирани snapshots; рекламите во живо од Meta (кампања→adset→ад).
 */

const n = (d: unknown): number => (d == null ? 0 : Number(d));

/** Листа месеци [from..to] како YYYY-MM. */
function monthsBetween(from: string, to: string): string[] {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const out: string[] = [];
  let y = fy!;
  let m = fm!;
  for (let i = 0; i < 120 && (y < ty! || (y === ty! && m <= tm!)); i++) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

const monthKeyOf = (d: Date | null): string | null =>
  d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}` : null;

export interface IgPost {
  id: string;
  permalink: string | null;
  mediaKind: 'video' | 'image';
  month: string | null;
  reach: number;
  engagement: number;
  views: number;
}
export interface MonthMetric {
  month: string;
  reach: number;
  engagement: number;
  views: number;
  impressions: number;
  spend: number;
  posts: number;
}
export interface AdNode {
  id: string;
  name: string;
  spend: number;
  reach: number;
  impressions: number;
  ctr: number | null;
  byMonth: MonthMetric[];
  children?: AdNode[];
}

export interface ClientAnalytics {
  clientId: string;
  clientName: string;
  from: string;
  to: string;
  instagram: {
    connected: boolean;
    totals: { reach: number; engagement: number; views: number; posts: number };
    byKind: Array<{
      kind: 'video' | 'image';
      posts: number;
      reach: number;
      engagement: number;
      views: number;
    }>;
    byMonth: MonthMetric[];
    topPosts: IgPost[];
  };
  facebook: {
    connected: boolean;
    note: string;
    byMonth: Array<{
      month: string;
      followers: number | null;
      engagement: number | null;
      pageViews: number | null;
      newFollows: number | null;
      videoViews: number | null;
      reactions: number | null;
    }>;
  };
  ads: {
    connected: boolean;
    totals: { spend: number; reach: number; impressions: number };
    byMonth: MonthMetric[];
    campaigns: AdNode[];
  };
}

export async function getClientAnalytics(
  clientId: string,
  from: string,
  to: string,
): Promise<ClientAnalytics> {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);

  const months = monthsBetween(from, to);
  const monthSet = new Set(months);
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const start = new Date(Date.UTC(fy!, fm! - 1, 1));
  const end = new Date(Date.UTC(ty!, tm!, 1)); // ексклузивно

  // ── Instagram (складирано) ──
  const igPubs = await prisma.publication.findMany({
    where: {
      platform: 'ig',
      OR: [{ clientId }, { task: { clientId } }],
    },
    include: { task: { select: { group: { select: { monthKey: true } } } } },
  });
  const igIds = igPubs.map((p) => p.id);
  const igSnaps = igIds.length
    ? await prisma.metricSnapshot.findMany({
        where: { publicationId: { in: igIds } },
        orderBy: { capturedAt: 'desc' },
        distinct: ['publicationId'],
      })
    : [];
  const igByPub = new Map(igSnaps.map((s) => [s.publicationId, s]));

  const igPosts: IgPost[] = [];
  for (const p of igPubs) {
    const month = monthKeyOf(p.publishedAt) ?? p.task?.group?.monthKey ?? null;
    if (!month || !monthSet.has(month)) continue;
    const s = igByPub.get(p.id);
    igPosts.push({
      id: p.id,
      permalink: p.permalink,
      mediaKind: p.postType === 'reel' ? 'video' : 'image',
      month,
      reach: n(s?.reach),
      engagement: n(s?.engagement),
      views: n(s?.views),
    });
  }
  const igByMonth: MonthMetric[] = months.map((mo) => {
    const rows = igPosts.filter((p) => p.month === mo);
    return {
      month: mo,
      reach: rows.reduce((a, r) => a + r.reach, 0),
      engagement: rows.reduce((a, r) => a + r.engagement, 0),
      views: rows.reduce((a, r) => a + r.views, 0),
      impressions: 0,
      spend: 0,
      posts: rows.length,
    };
  });
  const kindAgg = (kind: 'video' | 'image') => {
    const rows = igPosts.filter((p) => p.mediaKind === kind);
    return {
      kind,
      posts: rows.length,
      reach: rows.reduce((a, r) => a + r.reach, 0),
      engagement: rows.reduce((a, r) => a + r.engagement, 0),
      views: rows.reduce((a, r) => a + r.views, 0),
    };
  };

  // ── Facebook (page-ниво, складирано; reach укинат од Meta) ──
  const fbSnaps = client.metaPageId
    ? await prisma.pageSnapshot.findMany({
        where: { clientId, capturedAt: { gte: start, lt: end } },
        orderBy: { capturedAt: 'asc' },
      })
    : [];
  const fbByMonth = new Map<string, (typeof fbSnaps)[number]>();
  for (const s of fbSnaps) {
    const mo = monthKeyOf(s.capturedAt);
    if (mo) fbByMonth.set(mo, s); // последен по месец (asc → последниот останува)
  }

  // ── Реклами (во живо од Meta, кампања→adset→ад) ──
  let ads: ClientAnalytics['ads'] = {
    connected: false,
    totals: { spend: 0, reach: 0, impressions: 0 },
    byMonth: [],
    campaigns: [],
  };
  if (client.metaAdAccountId) {
    const until = new Date(Date.UTC(ty!, tm!, 0)); // последен ден од `to`
    const rows = await getMetaClient()
      .fetchAdInsightsTree(
        client.metaAdAccountId,
        `${from}-01`,
        `${until.getUTCFullYear()}-${String(until.getUTCMonth() + 1).padStart(2, '0')}-${String(until.getUTCDate()).padStart(2, '0')}`,
      )
      .catch(() => []);
    ads = buildAdsSection(
      rows.filter((r) => monthSet.has(r.month)),
      months,
    );
  }

  return {
    clientId,
    clientName: client.name,
    from,
    to,
    instagram: {
      connected: !!client.metaIgId,
      totals: {
        reach: igPosts.reduce((a, r) => a + r.reach, 0),
        engagement: igPosts.reduce((a, r) => a + r.engagement, 0),
        views: igPosts.reduce((a, r) => a + r.views, 0),
        posts: igPosts.length,
      },
      byKind: [kindAgg('video'), kindAgg('image')],
      byMonth: igByMonth,
      topPosts: [...igPosts].sort((a, b) => b.reach - a.reach).slice(0, 10),
    },
    facebook: {
      connected: !!client.metaPageId,
      note: 'Досегот по страница е укинат од Meta (v21) — прикажани се достапните метрики.',
      byMonth: months
        .filter((mo) => fbByMonth.has(mo))
        .map((mo) => {
          const s = fbByMonth.get(mo)!;
          return {
            month: mo,
            followers: s.followers,
            engagement: s.engagement,
            pageViews: s.pageViews,
            newFollows: s.newFollows,
            videoViews: s.videoViews,
            reactions: s.reactions,
          };
        }),
    },
    ads,
  };
}

/** Изгради кампања→adset→ад дрво + месечна разбивка од рамни ад×месец редови. */
function buildAdsSection(
  rows: Array<{
    campaignId: string;
    campaignName: string;
    adsetId: string;
    adsetName: string;
    adId: string;
    adName: string;
    month: string;
    spend: number;
    reach: number;
    impressions: number;
    ctr: number;
  }>,
  months: string[],
): ClientAnalytics['ads'] {
  const emptyMonth = (mo: string): MonthMetric => ({
    month: mo,
    reach: 0,
    engagement: 0,
    views: 0,
    impressions: 0,
    spend: 0,
    posts: 0,
  });
  const agg = (rs: typeof rows): Omit<AdNode, 'id' | 'name' | 'children'> => {
    const byMonth = months.map((mo) => {
      const mr = rs.filter((r) => r.month === mo);
      const m = emptyMonth(mo);
      m.spend = mr.reduce((a, r) => a + r.spend, 0);
      m.reach = mr.reduce((a, r) => a + r.reach, 0);
      m.impressions = mr.reduce((a, r) => a + r.impressions, 0);
      return m;
    });
    const spend = rs.reduce((a, r) => a + r.spend, 0);
    const impressions = rs.reduce((a, r) => a + r.impressions, 0);
    const reach = rs.reduce((a, r) => a + r.reach, 0);
    const clicks = rs.reduce((a, r) => a + (r.ctr / 100) * r.impressions, 0);
    return {
      spend,
      reach,
      impressions,
      ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : null,
      byMonth: byMonth.filter((m) => m.spend > 0 || m.impressions > 0),
    };
  };

  const campIds = [...new Set(rows.map((r) => r.campaignId))];
  const campaigns: AdNode[] = campIds.map((cid) => {
    const cRows = rows.filter((r) => r.campaignId === cid);
    const adsetIds = [...new Set(cRows.map((r) => r.adsetId))];
    const children: AdNode[] = adsetIds.map((asid) => {
      const asRows = cRows.filter((r) => r.adsetId === asid);
      const adIds = [...new Set(asRows.map((r) => r.adId))];
      const adNodes: AdNode[] = adIds.map((adid) => {
        const adRows = asRows.filter((r) => r.adId === adid);
        return { id: adid, name: adRows[0]?.adName ?? adid, ...agg(adRows) };
      });
      return { id: asid, name: asRows[0]?.adsetName ?? asid, ...agg(asRows), children: adNodes };
    });
    return { id: cid, name: cRows[0]?.campaignName ?? cid, ...agg(cRows), children };
  });
  campaigns.sort((a, b) => b.spend - a.spend);

  return {
    connected: true,
    totals: {
      spend: rows.reduce((a, r) => a + r.spend, 0),
      reach: rows.reduce((a, r) => a + r.reach, 0),
      impressions: rows.reduce((a, r) => a + r.impressions, 0),
    },
    byMonth: months.map((mo) => {
      const mr = rows.filter((r) => r.month === mo);
      return {
        month: mo,
        reach: mr.reduce((a, r) => a + r.reach, 0),
        engagement: 0,
        views: 0,
        impressions: mr.reduce((a, r) => a + r.impressions, 0),
        spend: mr.reduce((a, r) => a + r.spend, 0),
        posts: 0,
      };
    }),
    campaigns,
  };
}
