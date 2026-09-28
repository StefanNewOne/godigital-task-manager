import type {
  AccountMediaItem,
  AdCampaignItem,
  MetaAccount,
  MetaAdAccount,
  MetaClient,
  PublicationRef,
} from './metaClient.js';

/**
 * Реален Meta Graph API адаптер (B2). Се користи само во прод кога постои системски токен;
 * во dev/тест факторијата бира stub. Враќа СУРОВ Graph одговор (core го нормализира).
 *
 * IG media id (O-B2a решено): shortcode-от од permalink се совпаѓа во media edge на IG-сметката
 * (`resolveMediaId` со `client.metaIgId`) за да се добие нумеричкиот media id за insights.
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
    // IG: shortcode (externalRef) не е употреблив како node id — се совпаѓа во media edge на
    // сметката за да се добие нумеричкиот media id. FB: externalRef е директно node id.
    if (pub.platform === 'ig' && pub.igId && pub.externalRef) {
      const media = await this.fetchAccountMedia(pub.igId, 200);
      const hit = media.find(
        (m) => m.shortcode === pub.externalRef || (pub.permalink && m.permalink === pub.permalink),
      );
      return hit?.mediaId ?? null;
    }
    return pub.externalRef;
  }

  async listAccounts(): Promise<MetaAccount[]> {
    const enc = encodeURIComponent(this.token);
    const out: MetaAccount[] = [];
    let url: string | null =
      `${this.base}/me/accounts?fields=name,instagram_business_account{id,username}&limit=100&access_token=${enc}`;
    // Пагинирано; ограничено на 10 страници за безбедност.
    for (let i = 0; i < 10 && url; i++) {
      const page = (await this.get(url)) as {
        data?: Array<{
          id: string;
          name: string;
          instagram_business_account?: { id: string; username?: string };
        }>;
        paging?: { next?: string };
      };
      for (const p of page.data ?? []) {
        out.push({
          pageId: p.id,
          pageName: p.name,
          igId: p.instagram_business_account?.id ?? null,
          igUsername: p.instagram_business_account?.username ?? null,
        });
      }
      url = page.paging?.next ?? null;
    }
    return out;
  }

  async fetchAccountMedia(igId: string, limit: number): Promise<AccountMediaItem[]> {
    const enc = encodeURIComponent(this.token);
    const out: AccountMediaItem[] = [];
    let url: string | null =
      `${this.base}/${igId}/media?fields=id,shortcode,permalink,media_type,timestamp&limit=${Math.min(limit, 100)}&access_token=${enc}`;
    for (let i = 0; i < 10 && url && out.length < limit; i++) {
      const page = (await this.get(url)) as {
        data?: Array<{
          id: string;
          shortcode?: string;
          permalink?: string;
          media_type?: string;
          timestamp?: string;
        }>;
        paging?: { next?: string };
      };
      for (const m of page.data ?? []) {
        out.push({
          mediaId: m.id,
          shortcode: m.shortcode ?? null,
          permalink: m.permalink ?? null,
          mediaType: m.media_type ?? null,
          timestamp: m.timestamp ?? null,
        });
      }
      url = page.paging?.next ?? null;
    }
    return out.slice(0, limit);
  }

  async fetchMediaInsights(input: { platform: string; mediaId: string }): Promise<unknown> {
    // v21: `impressions`/`video_views` се укинати за IG медиа; `views` важи само за видео/reels
    // (фото/carousel немаат views → цел повик паѓа ако се бара). Затоа метриките зависат од типот.
    const enc = encodeURIComponent(this.token);
    let isVideo = false;
    try {
      const meta = (await this.get(
        `${this.base}/${input.mediaId}?fields=media_type&access_token=${enc}`,
      )) as { media_type?: string };
      isVideo = meta.media_type === 'VIDEO' || meta.media_type === 'REELS';
    } catch {
      // ако не можеме да го земеме типот, оди со безбедниот сет
    }
    const metrics = isVideo ? 'reach,views,total_interactions' : 'reach,total_interactions';
    const url = `${this.base}/${input.mediaId}/insights?metric=${metrics}&access_token=${enc}`;
    return this.get(url);
  }

  async fetchAdInsights(input: { metaCampaignId: string }): Promise<unknown> {
    // date_preset=maximum → вкупни (lifetime) метрики на кампањата (за backfill и тековно).
    const fields = 'reach,impressions,spend,ctr,frequency,cost_per_result';
    const url = `${this.base}/${input.metaCampaignId}/insights?fields=${fields}&date_preset=maximum&access_token=${encodeURIComponent(this.token)}`;
    return this.get(url);
  }

  async listAdAccounts(): Promise<MetaAdAccount[]> {
    const enc = encodeURIComponent(this.token);
    const out: MetaAdAccount[] = [];
    let url: string | null = `${this.base}/me/adaccounts?fields=name&limit=200&access_token=${enc}`;
    for (let i = 0; i < 10 && url; i++) {
      const page = (await this.get(url)) as {
        data?: Array<{ id: string; name: string }>;
        paging?: { next?: string };
      };
      for (const a of page.data ?? []) out.push({ id: a.id, name: a.name });
      url = page.paging?.next ?? null;
    }
    return out;
  }

  async fetchCampaigns(adAccountId: string, limit: number): Promise<AdCampaignItem[]> {
    const enc = encodeURIComponent(this.token);
    const out: AdCampaignItem[] = [];
    let url: string | null =
      `${this.base}/${adAccountId}/campaigns?fields=id,name,status,objective,start_time,stop_time&limit=${Math.min(limit, 100)}&access_token=${enc}`;
    for (let i = 0; i < 10 && url && out.length < limit; i++) {
      const page = (await this.get(url)) as {
        data?: Array<{
          id: string;
          name: string;
          status?: string;
          objective?: string;
          start_time?: string;
          stop_time?: string;
        }>;
        paging?: { next?: string };
      };
      for (const c of page.data ?? []) {
        out.push({
          campaignId: c.id,
          name: c.name,
          status: c.status ?? null,
          objective: c.objective ?? null,
          startTime: c.start_time ?? null,
          stopTime: c.stop_time ?? null,
        });
      }
      url = page.paging?.next ?? null;
    }
    return out.slice(0, limit);
  }

  private async get(url: string): Promise<unknown> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Meta Graph ${res.status}`);
    }
    return res.json();
  }
}
