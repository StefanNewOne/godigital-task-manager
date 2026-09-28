import type {
  AccountMediaItem,
  AdCampaignItem,
  MetaAccount,
  MetaAdAccount,
  MetaClient,
  PageMetrics,
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

  async fetchPageMetrics(pageId: string): Promise<PageMetrics> {
    const enc = encodeURIComponent(this.token);
    // 1) Page токен + followers (page-insights бараат page access token, не системски — #210).
    const meta = (await this.get(
      `${this.base}/${pageId}?fields=access_token,followers_count,fan_count&access_token=${enc}`,
    )) as { access_token?: string; followers_count?: number; fan_count?: number };
    const followers = meta.followers_count ?? meta.fan_count ?? null;
    const raw: Record<string, unknown> = { followers_count: meta.followers_count };
    if (!meta.access_token) {
      return {
        followers,
        engagement: null,
        pageViews: null,
        newFollows: null,
        videoViews: null,
        reactions: null,
        raw,
      };
    }
    // 2) Достапни page insights (reach/impressions се укинати во v21).
    const pt = encodeURIComponent(meta.access_token);
    const metrics =
      'page_post_engagements,page_views_total,page_daily_follows_unique,page_video_views,page_actions_post_reactions_total';
    let insights: unknown = null;
    try {
      insights = await this.get(
        `${this.base}/${pageId}/insights?metric=${metrics}&period=days_28&access_token=${pt}`,
      );
    } catch {
      // best-effort — followers сепак се враќаат
    }
    raw.insights = insights;
    const val = (name: string) => pickPageMetric(insights, name);
    return {
      followers,
      engagement: val('page_post_engagements'),
      pageViews: val('page_views_total'),
      newFollows: val('page_daily_follows_unique'),
      videoViews: val('page_video_views'),
      reactions: val('page_actions_post_reactions_total'),
      raw,
    };
  }

  private async get(url: string): Promise<unknown> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Meta Graph ${res.status}`);
    }
    return res.json();
  }
}

/** Извлечи ја последната нумеричка вредност за page-метрика (сумира ако е breakdown object). */
function pickPageMetric(insights: unknown, name: string): number | null {
  const data = (insights as { data?: Array<{ name: string; values?: Array<{ value: unknown }> }> })
    ?.data;
  const entry = data?.find((d) => d.name === name);
  const value = entry?.values?.[entry.values.length - 1]?.value;
  if (typeof value === 'number') return value;
  if (value && typeof value === 'object') {
    const sum = Object.values(value as Record<string, unknown>).reduce<number>(
      (acc, v) => acc + (typeof v === 'number' ? v : 0),
      0,
    );
    return sum;
  }
  return null;
}
