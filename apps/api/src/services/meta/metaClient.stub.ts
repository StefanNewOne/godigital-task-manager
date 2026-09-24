import type { MetaClient, PublicationRef } from './metaClient.js';

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
