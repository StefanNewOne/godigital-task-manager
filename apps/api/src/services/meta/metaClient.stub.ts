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
  TokenDebug,
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

  async fetchPageMetrics(pageId: string): Promise<PageMetrics> {
    const h = hash(pageId);
    return {
      followers: 1_000 + (h % 50_000),
      engagement: 100 + (h % 5_000),
      pageViews: 200 + (h % 8_000),
      newFollows: h % 500,
      videoViews: 500 + (h % 100_000),
      reactions: h % 2_000,
      raw: { stub: true },
    };
  }

  async fetchAdInsightsTree(
    adAccountId: string,
    since: string,
    _until: string,
  ): Promise<AdInsightRow[]> {
    const month = since.slice(0, 7);
    const rows: AdInsightRow[] = [];
    for (let c = 1; c <= 2; c++) {
      const h = hash(`${adAccountId}_${c}_${month}`);
      rows.push({
        campaignId: `camp_${c}`,
        campaignName: `Stub Campaign ${c}`,
        adsetId: `adset_${c}`,
        adsetName: `Stub Adset ${c}`,
        adId: `ad_${c}`,
        adName: `Stub Ad ${c}`,
        month,
        spend: 20 + (h % 300),
        reach: 5000 + (h % 40000),
        impressions: 10000 + (h % 80000),
        ctr: 1 + (h % 400) / 100,
      });
    }
    return rows;
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

  // ── Модул 3 · Мета — нови read методи (§6), детерминистички ──

  async listAdAccountsDetailed(): Promise<AdAccountDetailed[]> {
    return [
      {
        id: 'act_stub_1',
        name: 'Stub Ad Account A',
        currency: 'EUR',
        accountStatus: 'ACTIVE',
        disableReason: null,
        spendCap: 5000,
        amountSpent: 1200,
        userTasks: ['ANALYZE', 'ADVERTISE'],
      },
      {
        id: 'act_stub_2',
        name: 'Stub Ad Account B',
        currency: 'USD',
        accountStatus: 'ACTIVE',
        disableReason: null,
        spendCap: null,
        amountSpent: 300,
        userTasks: ['ANALYZE'],
      },
    ];
  }

  async fetchStructure(adAccountId: string): Promise<MetaStructure> {
    const h = hash(adAccountId);
    const campMeta = `camp_${adAccountId}`;
    const adsetMeta = `adset_${adAccountId}`;
    const adMeta = `ad_${adAccountId}`;
    return {
      campaigns: [
        {
          metaId: campMeta,
          name: 'Stub Campaign 1',
          objective: 'OUTCOME_ENGAGEMENT',
          status: 'ACTIVE',
          effectiveStatus: 'ACTIVE',
          dailyBudget: 10 + (h % 90),
          startTime: '2035-06-01T00:00:00+0000',
          stopTime: null,
          raw: { stub: true },
        },
      ],
      adsets: [
        {
          metaId: adsetMeta,
          campaignMetaId: campMeta,
          name: 'Stub Ad Set 1',
          status: 'ACTIVE',
          effectiveStatus: 'ACTIVE',
          optimizationGoal: 'CONVERSATIONS',
          learningStage: h % 3 === 0 ? 'LIMITED' : 'SUCCESS',
          raw: { stub: true },
        },
      ],
      ads: [
        {
          metaId: adMeta,
          adSetMetaId: adsetMeta,
          name: 'Stub Ad 1',
          status: 'ACTIVE',
          effectiveStatus: 'ACTIVE',
          reviewStatus: h % 5 === 0 ? 'rejected' : 'approved',
          sourcePostMetaId: null,
          raw: { stub: true },
        },
      ],
    };
  }

  async fetchInsightsDaily(
    adAccountId: string,
    level: InsightLevel,
    since: string,
    _until: string,
  ): Promise<InsightDailyRow[]> {
    const h = hash(`${adAccountId}_${level}_${since}`);
    const spend = 20 + (h % 300);
    const impressions = 5_000 + (h % 60_000);
    const reach = Math.round(impressions * 0.7);
    const results = 10 + (h % 200);
    return [
      {
        level,
        objectMetaId: `${level}_${adAccountId}`,
        date: since,
        spend,
        impressions,
        reach,
        frequency: Math.round((impressions / reach) * 100) / 100,
        clicks: Math.round(impressions * 0.01),
        ctr: Math.round((0.8 + (h % 200) / 100) * 100) / 100,
        results,
        resultType: 'onsite_conversion.messaging_conversation_started_7d',
        actions: [{ action_type: 'onsite_conversion', value: String(results) }],
      },
    ];
  }

  async fetchPageConversations(pageId: string): Promise<ConversationItem[]> {
    const h = hash(pageId);
    return [
      {
        threadId: `t_msgr_${pageId}`,
        channel: 'messenger',
        participantName: 'Стуб Корисник',
        sourceAdMetaId: h % 2 === 0 ? `ad_${pageId}` : null,
        lastMessageAt: '2035-06-10T09:00:00+0000',
        unread: h % 2 === 0,
      },
    ];
  }

  async fetchIgConversations(igId: string): Promise<ConversationItem[]> {
    const h = hash(igId);
    return [
      {
        threadId: `t_ig_${igId}`,
        channel: 'instagram',
        participantName: 'stub_ig_user',
        sourceAdMetaId: null,
        lastMessageAt: '2035-06-10T10:00:00+0000',
        unread: h % 3 === 0,
      },
    ];
  }

  async fetchConversationMessages(threadId: string): Promise<MessageItem[]> {
    const h = hash(threadId);
    return [
      {
        messageId: `m_${threadId}_1`,
        fromPage: false,
        text: 'Здраво, дали е достапно?',
        sentAt: '2035-06-10T09:00:00+0000',
      },
      {
        messageId: `m_${threadId}_2`,
        fromPage: true,
        text: h % 2 === 0 ? 'Да, достапно е.' : 'Ви благодариме на пораката.',
        sentAt: '2035-06-10T09:05:00+0000',
      },
    ];
  }

  async fetchComments(objectMetaId: string): Promise<CommentItem[]> {
    const h = hash(objectMetaId);
    return [
      {
        commentId: `c_${objectMetaId}_1`,
        parentMetaId: objectMetaId,
        authorName: 'Стуб Коментатор',
        text: h % 2 === 0 ? 'Колку чини?' : 'Одлично!',
        createdTime: '2035-06-10T11:00:00+0000',
      },
    ];
  }

  async checkIgMessagingAccess(igId: string): Promise<boolean> {
    return hash(igId) % 4 !== 0; // повеќето имаат пристап; понекогаш не (за A11)
  }

  async debugToken(token: string): Promise<TokenDebug> {
    return {
      expiresAt: null, // System User токен — без истек
      scopes: ['ads_read', 'read_insights', 'pages_show_list'],
      isValid: token.length > 0,
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
