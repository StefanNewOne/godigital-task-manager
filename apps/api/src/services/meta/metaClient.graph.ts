import type { MetaClient, PublicationRef } from './metaClient.js';

/**
 * Реален Meta Graph API адаптер (B2). Се користи само во прод кога постои системски токен;
 * во dev/тест факторијата бира stub. Враќа СУРОВ Graph одговор (core го нормализира).
 *
 * Забелешка (O-B2a): точниот сет метрики по платформа и резолуцијата на IG media id од
 * shortcode се финализираат при вклучување со реални credentials. Тука е разумен default:
 * `externalRef` (извлечен од permalink, PRD §4.8) се користи како media id.
 */
export class GraphMetaClient implements MetaClient {
  private readonly base: string;

  constructor(
    private readonly token: string,
    version: string,
  ) {
    this.base = `https://graph.facebook.com/${version}`;
  }

  async resolveMediaId(pub: PublicationRef): Promise<string | null> {
    // externalRef е веќе извлечениот id од линкот (§4.8). За повеќето случаи е директно
    // употреблив како node id; IG shortcode → media id lookup се додава со реални credentials.
    return pub.externalRef;
  }

  async fetchMediaInsights(input: { platform: string; mediaId: string }): Promise<unknown> {
    const metrics = 'reach,impressions,video_views,total_interactions';
    const url = `${this.base}/${input.mediaId}/insights?metric=${metrics}&access_token=${encodeURIComponent(this.token)}`;
    return this.get(url);
  }

  async fetchAdInsights(input: { metaCampaignId: string }): Promise<unknown> {
    const fields = 'reach,impressions,spend,ctr,frequency,cost_per_result';
    const url = `${this.base}/${input.metaCampaignId}/insights?fields=${fields}&access_token=${encodeURIComponent(this.token)}`;
    return this.get(url);
  }

  private async get(url: string): Promise<unknown> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Meta Graph ${res.status}`);
    }
    return res.json();
  }
}
