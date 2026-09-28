import type {
  AccountMediaItem,
  AdCampaignItem,
  MetaAccount,
  MetaAdAccount,
  MetaClient,
  PublicationRef,
} from './metaClient.js';

/**
 * Детерминистички stub на Meta адаптерот за dev/тест (без надворешни повици). Бројките се
 * изведени од стабилен hash на id-то → истиот вход дава ист излез (репродуцибилни тестови),
 * но различни објави даваат различни бројки. Обликот е „flat object" што `@gd/core`
 * `normalizeMetaInsights` го разбира.
 */
export class StubMetaClient implements MetaClient {
  async resolveMediaId(pub: PublicationRef): Promise<string | null> {
    if (!pub.externalRef) return null;
    return `stub_${pub.platform}_${pub.externalRef}`;
  }

  async fetchMediaInsights(input: { platform: string; mediaId: string }): Promise<unknown> {
    const h = hash(input.mediaId);
    const reach = 5_000 + (h % 80_000);
    const impressions = Math.round(reach * (1.2 + (h % 60) / 100));
    const views =
      input.platform === 'tiktok' || input.platform === 'ig' ? Math.round(reach * 0.7) : 0;
    const clicks = Math.round(impressions * (0.5 + (h % 30) / 100) * 0.01);
    return {
      reach,
      impressions,
      video_views: views,
      total_interactions: Math.round(reach * (0.02 + (h % 40) / 1000)),
      inline_link_clicks: clicks,
      // frequency/ctr ги пресметува core (deriveMetrics); тука ги немаме намерно.
    };
  }

  async listAccounts(): Promise<MetaAccount[]> {
    return [
      { pageId: 'stub_page_1', pageName: 'Stub Client A', igId: 'stub_ig_1', igUsername: 'stub_a' },
      { pageId: 'stub_page_2', pageName: 'Stub Client B', igId: 'stub_ig_2', igUsername: 'stub_b' },
    ];
  }

  async fetchAccountMedia(igId: string, limit: number): Promise<AccountMediaItem[]> {
    const n = Math.min(limit, 3);
    return Array.from({ length: n }, (_, i) => {
      const code = `stub${hash(igId + i)}`;
      return {
        mediaId: `stub_media_${igId}_${i}`,
        shortcode: code,
        permalink: `https://www.instagram.com/p/${code}/`,
        mediaType: i % 2 === 0 ? 'VIDEO' : 'IMAGE',
        // Детерминистички далечен месец (2035-06) за репродуцибилни backfill тестови.
        timestamp: `2035-06-1${i}T10:00:00+0000`,
      };
    });
  }

  async listAdAccounts(): Promise<MetaAdAccount[]> {
    return [
      { id: 'act_stub_1', name: 'Stub Ad Account A' },
      { id: 'act_stub_2', name: 'Stub Ad Account B' },
    ];
  }

  async fetchCampaigns(adAccountId: string, limit: number): Promise<AdCampaignItem[]> {
    const n = Math.min(limit, 2);
    return Array.from({ length: n }, (_, i) => ({
      campaignId: `stub_camp_${adAccountId}_${i}`,
      name: `Stub Campaign ${i + 1}`,
      status: 'ACTIVE',
      objective: 'OUTCOME_TRAFFIC',
      startTime: `2035-06-0${i + 1}T00:00:00+0000`,
      stopTime: `2035-06-2${i}T00:00:00+0000`,
    }));
  }

  async fetchAdInsights(input: { metaCampaignId: string }): Promise<unknown> {
    const h = hash(input.metaCampaignId);
    const spend = 50 + (h % 900);
    const reach = 10_000 + (h % 120_000);
    const impressions = Math.round(reach * (1.3 + (h % 50) / 100));
    const results = 100 + (h % 3_000);
    return {
      reach,
      impressions,
      spend,
      cost_per_result: Math.round((spend / results) * 100) / 100,
      ctr: Math.round((0.8 + (h % 200) / 100) * 100) / 100,
      frequency: Math.round((impressions / reach) * 100) / 100,
    };
  }
}

/** Стабилен ненегативен 31-битен hash (FNV-1a варијанта). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h | 0);
}
