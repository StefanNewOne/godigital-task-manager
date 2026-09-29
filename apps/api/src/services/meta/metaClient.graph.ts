import type {
  AccountMediaItem,
  AdAccountDetailed,
  AdCampaignItem,
  AdInsightRow,
  CommentItem,
  ConversationItem,
  InsightDailyRow,
  InsightLevel,
  MessageItem,
  MetaAccount,
  MetaAdAccount,
  MetaClient,
  MetaStructure,
  PageMetrics,
  PublicationRef,
  StructureAd,
  StructureAdSet,
  StructureCampaign,
  TokenDebug,
} from './metaClient.js';

const num = (v: unknown): number | null => {
  const n = typeof v === 'string' ? Number(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

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
    /** Втор токен за пораки/коментари (Модул 3 · Мета §5); ако недостасува, се користи системскиот. */
    private readonly inboxToken: string = token,
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

  async fetchAdInsightsTree(
    adAccountId: string,
    since: string,
    until: string,
  ): Promise<AdInsightRow[]> {
    const enc = encodeURIComponent(this.token);
    const fields =
      'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,spend,reach,impressions,ctr';
    const tr = encodeURIComponent(JSON.stringify({ since, until }));
    const out: AdInsightRow[] = [];
    let url: string | null =
      `${this.base}/${adAccountId}/insights?level=ad&fields=${fields}&time_increment=monthly&time_range=${tr}&limit=200&access_token=${enc}`;
    for (let i = 0; i < 25 && url; i++) {
      const page = (await this.get(url)) as {
        data?: Array<Record<string, string>>;
        paging?: { next?: string };
      };
      for (const r of page.data ?? []) {
        out.push({
          campaignId: r.campaign_id ?? '',
          campaignName: r.campaign_name ?? '',
          adsetId: r.adset_id ?? '',
          adsetName: r.adset_name ?? '',
          adId: r.ad_id ?? '',
          adName: r.ad_name ?? '',
          month: (r.date_start ?? '').slice(0, 7),
          spend: Number(r.spend ?? 0),
          reach: Number(r.reach ?? 0),
          impressions: Number(r.impressions ?? 0),
          ctr: Number(r.ctr ?? 0),
        });
      }
      url = page.paging?.next ?? null;
    }
    return out;
  }

  private async get(url: string): Promise<unknown> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Meta Graph ${res.status}`);
    }
    return res.json();
  }

  // ── Модул 3 · Мета — нови read методи (§6). Само GET; никогаш не пишуваат. ──

  async listAdAccountsDetailed(): Promise<AdAccountDetailed[]> {
    const enc = encodeURIComponent(this.token);
    const fields =
      'name,currency,account_status,disable_reason,spend_cap,amount_spent,users{tasks}';
    const page = (await this.get(
      `${this.base}/me/adaccounts?fields=${fields}&limit=100&access_token=${enc}`,
    )) as {
      data?: Array<{
        id: string;
        name?: string;
        currency?: string;
        account_status?: number;
        disable_reason?: number;
        spend_cap?: string;
        amount_spent?: string;
        users?: { data?: Array<{ tasks?: string[] }> };
      }>;
    };
    return (page.data ?? []).map((a) => ({
      id: a.id,
      name: a.name ?? a.id,
      currency: a.currency ?? null,
      accountStatus: a.account_status != null ? String(a.account_status) : null,
      disableReason: a.disable_reason != null ? String(a.disable_reason) : null,
      spendCap: num(a.spend_cap),
      amountSpent: num(a.amount_spent),
      userTasks: a.users?.data?.flatMap((u) => u.tasks ?? []) ?? [],
    }));
  }

  async fetchStructure(adAccountId: string): Promise<MetaStructure> {
    const enc = encodeURIComponent(this.token);
    const camps = (await this.get(
      `${this.base}/${adAccountId}/campaigns?fields=name,objective,status,effective_status,daily_budget,start_time,stop_time&limit=200&access_token=${enc}`,
    )) as { data?: Array<Record<string, unknown>> };
    const adsets = (await this.get(
      `${this.base}/${adAccountId}/adsets?fields=name,campaign_id,status,effective_status,optimization_goal,learning_stage_info&limit=500&access_token=${enc}`,
    )) as { data?: Array<Record<string, unknown>> };
    const ads = (await this.get(
      `${this.base}/${adAccountId}/ads?fields=name,adset_id,status,effective_status,effective_object_story_id,ad_review_feedback&limit=1000&access_token=${enc}`,
    )) as { data?: Array<Record<string, unknown>> };
    const campaigns: StructureCampaign[] = (camps.data ?? []).map((c) => ({
      metaId: String(c.id),
      name: String(c.name ?? ''),
      objective: (c.objective as string) ?? null,
      status: (c.status as string) ?? null,
      effectiveStatus: (c.effective_status as string) ?? null,
      dailyBudget: num(c.daily_budget),
      startTime: (c.start_time as string) ?? null,
      stopTime: (c.stop_time as string) ?? null,
      raw: c,
    }));
    const adsetRows: StructureAdSet[] = (adsets.data ?? []).map((s) => ({
      metaId: String(s.id),
      campaignMetaId: String(s.campaign_id ?? ''),
      name: String(s.name ?? ''),
      status: (s.status as string) ?? null,
      effectiveStatus: (s.effective_status as string) ?? null,
      optimizationGoal: (s.optimization_goal as string) ?? null,
      learningStage:
        ((s.learning_stage_info as { status?: string })?.status as string | undefined) ?? null,
      raw: s,
    }));
    const adRows: StructureAd[] = (ads.data ?? []).map((a) => ({
      metaId: String(a.id),
      adSetMetaId: String(a.adset_id ?? ''),
      name: String(a.name ?? ''),
      status: (a.status as string) ?? null,
      effectiveStatus: (a.effective_status as string) ?? null,
      reviewStatus:
        ((a.ad_review_feedback as { status?: string })?.status as string | undefined) ?? null,
      sourcePostMetaId: (a.effective_object_story_id as string) ?? null,
      raw: a,
    }));
    return { campaigns, adsets: adsetRows, ads: adRows };
  }

  async fetchInsightsDaily(
    adAccountId: string,
    level: InsightLevel,
    since: string,
    until: string,
  ): Promise<InsightDailyRow[]> {
    const enc = encodeURIComponent(this.token);
    const idField = level === 'campaign' ? 'campaign_id' : level === 'adset' ? 'adset_id' : 'ad_id';
    const fields = `${idField},spend,impressions,reach,frequency,clicks,ctr,actions`;
    const tr = encodeURIComponent(JSON.stringify({ since, until }));
    const page = (await this.get(
      `${this.base}/${adAccountId}/insights?level=${level}&time_increment=1&fields=${fields}&time_range=${tr}&limit=500&access_token=${enc}`,
    )) as { data?: Array<Record<string, unknown>> };
    return (page.data ?? []).map((r) => ({
      level,
      objectMetaId: String(r[idField] ?? ''),
      date: String(r.date_start ?? since),
      spend: num(r.spend) ?? 0,
      impressions: num(r.impressions) ?? 0,
      reach: num(r.reach) ?? 0,
      frequency: num(r.frequency) ?? 0,
      clicks: num(r.clicks) ?? 0,
      ctr: num(r.ctr) ?? 0,
      results: 0, // резултатот се извлекува по Objective од `actions` во core (М2)
      resultType: null,
      actions: r.actions ?? null,
    }));
  }

  async fetchPageConversations(pageId: string): Promise<ConversationItem[]> {
    return this.fetchConversations(pageId, 'messenger', '');
  }

  async fetchIgConversations(igId: string): Promise<ConversationItem[]> {
    return this.fetchConversations(igId, 'instagram', 'instagram');
  }

  private async fetchConversations(
    nodeId: string,
    channel: 'messenger' | 'instagram',
    platform: string,
  ): Promise<ConversationItem[]> {
    const enc = encodeURIComponent(this.inboxToken);
    const plat = platform ? `platform=${platform}&` : '';
    const page = (await this.get(
      `${this.base}/${nodeId}/conversations?${plat}fields=participants,updated_time,unread_count,message_count&limit=100&access_token=${enc}`,
    )) as {
      data?: Array<{
        id: string;
        updated_time?: string;
        unread_count?: number;
        participants?: { data?: Array<{ name?: string }> };
      }>;
    };
    return (page.data ?? []).map((c) => ({
      threadId: c.id,
      channel,
      participantName: c.participants?.data?.[0]?.name ?? null,
      sourceAdMetaId: null,
      lastMessageAt: c.updated_time ?? null,
      unread: (c.unread_count ?? 0) > 0,
    }));
  }

  async fetchConversationMessages(threadId: string): Promise<MessageItem[]> {
    const enc = encodeURIComponent(this.inboxToken);
    const page = (await this.get(
      `${this.base}/${threadId}?fields=messages{id,from,message,created_time}&access_token=${enc}`,
    )) as {
      messages?: {
        data?: Array<{
          id: string;
          from?: { id?: string };
          message?: string;
          created_time?: string;
        }>;
      };
    };
    return (page.messages?.data ?? []).map((m) => ({
      messageId: m.id,
      fromPage: false, // распознавањето „од страница" се прави во М4 според from.id vs page id
      text: m.message ?? null,
      sentAt: m.created_time ?? null,
    }));
  }

  async fetchComments(objectMetaId: string): Promise<CommentItem[]> {
    const enc = encodeURIComponent(this.inboxToken);
    const page = (await this.get(
      `${this.base}/${objectMetaId}/comments?fields=from,message,created_time&limit=200&access_token=${enc}`,
    )) as {
      data?: Array<{
        id: string;
        from?: { name?: string };
        message?: string;
        created_time?: string;
      }>;
    };
    return (page.data ?? []).map((c) => ({
      commentId: c.id,
      parentMetaId: objectMetaId,
      authorName: c.from?.name ?? null,
      text: c.message ?? null,
      createdTime: c.created_time ?? null,
    }));
  }

  async checkIgMessagingAccess(igId: string): Promise<boolean> {
    try {
      const enc = encodeURIComponent(this.inboxToken);
      await this.get(
        `${this.base}/${igId}/conversations?platform=instagram&limit=1&access_token=${enc}`,
      );
      return true;
    } catch {
      return false;
    }
  }

  async debugToken(token: string): Promise<TokenDebug> {
    const enc = encodeURIComponent(token);
    const app = encodeURIComponent(this.token);
    const res = (await this.get(
      `${this.base}/debug_token?input_token=${enc}&access_token=${app}`,
    )) as {
      data?: { expires_at?: number; scopes?: string[]; is_valid?: boolean };
    };
    const d = res.data ?? {};
    return {
      expiresAt: d.expires_at ? new Date(d.expires_at * 1000).toISOString() : null,
      scopes: d.scopes ?? [],
      isValid: d.is_valid ?? false,
    };
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
