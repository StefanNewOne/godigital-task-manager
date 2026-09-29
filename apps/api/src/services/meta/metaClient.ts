import { env } from '../../env.js';
import { StubMetaClient } from './metaClient.stub.js';
import { GraphMetaClient } from './metaClient.graph.js';

/** Минимален опис на објава потребен за резолуција на media id. */
export interface PublicationRef {
  platform: 'fb' | 'ig' | 'tiktok';
  externalRef: string | null;
  permalink: string | null;
  /** IG business account id на клиентот (за match на media edge, B2). */
  igId?: string | null;
}

/** Meta сметка достапна со системскиот токен (страница + поврзана IG business сметка). */
export interface MetaAccount {
  pageId: string;
  pageName: string;
  igId: string | null;
  igUsername: string | null;
}

/** Суров опис на медиа од сметка (за backfill). */
export interface AccountMediaItem {
  mediaId: string;
  shortcode: string | null;
  permalink: string | null;
  mediaType: string | null;
  timestamp: string | null;
}

/** Рекламна сметка достапна со системскиот токен. */
export interface MetaAdAccount {
  /** Node id со префикс, пр. `act_123`. */
  id: string;
  name: string;
}

/** Кампања од рекламна сметка (за backfill на платени метрики). */
export interface AdCampaignItem {
  campaignId: string;
  name: string;
  status: string | null;
  objective: string | null;
  startTime: string | null;
  stopTime: string | null;
}

/** Еден ред ад-insight по (ад × месец) со родителски имиња — за хиерархија кампања→adset→ад. */
export interface AdInsightRow {
  campaignId: string;
  campaignName: string;
  adsetId: string;
  adsetName: string;
  adId: string;
  adName: string;
  /** YYYY-MM (месец на редот). */
  month: string;
  spend: number;
  reach: number;
  impressions: number;
  ctr: number;
}

/** FB page-ниво метрики (reach е укинат од Meta v21 — недостапно). */
export interface PageMetrics {
  followers: number | null;
  /** Ангажман (page_post_engagements, 28 дена). */
  engagement: number | null;
  /** Page views (page_views_total, 28 дена). */
  pageViews: number | null;
  /** Нови follows (page_daily_follows_unique, 28 дена). */
  newFollows: number | null;
  /** Video views (page_video_views, 28 дена). */
  videoViews: number | null;
  /** Реакции (page_actions_post_reactions_total, 28 дена). */
  reactions: number | null;
  raw: unknown;
}

// ── Модул 3 · Мета — нови типови за читање (META_TECH_SPEC §6) ──

export interface AdAccountDetailed {
  id: string;
  name: string;
  currency: string | null;
  accountStatus: string | null;
  disableReason: string | null;
  spendCap: number | null;
  amountSpent: number | null;
  /** Partner задачи на System User-от (пр. `ANALYZE`, `MANAGE`). */
  userTasks: string[];
}

export interface StructureCampaign {
  metaId: string;
  name: string;
  objective: string | null;
  status: string | null;
  effectiveStatus: string | null;
  dailyBudget: number | null;
  startTime: string | null;
  stopTime: string | null;
  raw: unknown;
}
export interface StructureAdSet {
  metaId: string;
  campaignMetaId: string;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  optimizationGoal: string | null;
  learningStage: string | null;
  raw: unknown;
}
export interface StructureAd {
  metaId: string;
  adSetMetaId: string;
  name: string;
  status: string | null;
  effectiveStatus: string | null;
  reviewStatus: string | null;
  sourcePostMetaId: string | null;
  raw: unknown;
}
export interface MetaStructure {
  campaigns: StructureCampaign[];
  adsets: StructureAdSet[];
  ads: StructureAd[];
}

export type InsightLevel = 'campaign' | 'adset' | 'ad';
export interface InsightDailyRow {
  level: InsightLevel;
  objectMetaId: string;
  /** YYYY-MM-DD. */
  date: string;
  spend: number;
  impressions: number;
  reach: number;
  frequency: number;
  clicks: number;
  ctr: number;
  results: number;
  resultType: string | null;
  actions: unknown;
}

export interface ConversationItem {
  threadId: string;
  channel: 'messenger' | 'instagram';
  participantName: string | null;
  sourceAdMetaId: string | null;
  lastMessageAt: string | null;
  unread: boolean;
}
export interface MessageItem {
  messageId: string;
  fromPage: boolean;
  text: string | null;
  sentAt: string | null;
}
export interface CommentItem {
  commentId: string;
  parentMetaId: string;
  authorName: string | null;
  text: string | null;
  createdTime: string | null;
}
export interface TokenDebug {
  expiresAt: string | null;
  scopes: string[];
  isValid: boolean;
}

/**
 * Адаптер кон Meta Graph API (B2). Враќа СУРОВ Graph одговор — нормализацијата ја прави
 * `@gd/core` (`normalizeMetaInsights`/`deriveMetrics`). Никогаш не се повикува од frontend.
 * Модул 3 · Мета: САМО читање — ниту еден метод не пишува во Meta (D1).
 */
export interface MetaClient {
  /** Резолвирај го трајниот media id од објавата (PRD §4.8), или null ако не може. */
  resolveMediaId(pub: PublicationRef): Promise<string | null>;
  /** Суров insights одговор за органска медиа. */
  fetchMediaInsights(input: { platform: string; mediaId: string }): Promise<unknown>;
  /** Суров insights одговор за платена кампања. */
  fetchAdInsights(input: { metaCampaignId: string }): Promise<unknown>;
  /** Листа на достапни страници + IG business сметки (за доделба по клиент). */
  listAccounts(): Promise<MetaAccount[]>;
  /** Последни N медиа од IG business сметка (за backfill). */
  fetchAccountMedia(igId: string, limit: number): Promise<AccountMediaItem[]>;
  /** Листа на достапни рекламни сметки (за доделба по клиент). */
  listAdAccounts(): Promise<MetaAdAccount[]>;
  /** Кампањи од рекламна сметка (за backfill на платени метрики). */
  fetchCampaigns(adAccountId: string, limit: number): Promise<AdCampaignItem[]>;
  /** FB page-ниво метрики (followers, ангажман, page views…). */
  fetchPageMetrics(pageId: string): Promise<PageMetrics>;
  /** Ад insights по (ад × месец) за период — за хиерархија во Аналитика. */
  fetchAdInsightsTree(adAccountId: string, since: string, until: string): Promise<AdInsightRow[]>;

  // ── Модул 3 · Мета — нови read методи (§6) ──
  /** Детални рекламни сметки: валута, статус, spend cap, Partner задачи. */
  listAdAccountsDetailed(): Promise<AdAccountDetailed[]>;
  /** Огледало на структурата: кампањи → ad sets → ads (status, review, learning). */
  fetchStructure(adAccountId: string): Promise<MetaStructure>;
  /** Дневни insights по ниво за период (time_increment=1). */
  fetchInsightsDaily(
    adAccountId: string,
    level: InsightLevel,
    since: string,
    until: string,
  ): Promise<InsightDailyRow[]>;
  /** Messenger разговори на страница. */
  fetchPageConversations(pageId: string, sinceCursor?: string): Promise<ConversationItem[]>;
  /** Instagram разговори. */
  fetchIgConversations(igId: string, sinceCursor?: string): Promise<ConversationItem[]>;
  /** Пораки во разговор. */
  fetchConversationMessages(threadId: string, sinceCursor?: string): Promise<MessageItem[]>;
  /** Коментари на ад или пост објект. */
  fetchComments(objectMetaId: string, since?: string): Promise<CommentItem[]>;
  /** Дали IG business сметката дозволува пристап до пораки (за A11). */
  checkIgMessagingAccess(igId: string): Promise<boolean>;
  /** Метаподатоци за токен (истек, scopes, важност) — за A12. */
  debugToken(token: string): Promise<TokenDebug>;
}

let singleton: MetaClient | null = null;

/**
 * Фабрика: реален Graph адаптер ако постои системски токен, инаку детерминистички stub
 * (dev/тест — целиот пајплајн работи без надворешни повици).
 */
export function getMetaClient(): MetaClient {
  if (!singleton) {
    singleton = env.META_SYSTEM_TOKEN
      ? new GraphMetaClient(
          env.META_SYSTEM_TOKEN,
          env.META_GRAPH_VERSION,
          env.META_INBOX_TOKEN ?? env.META_SYSTEM_TOKEN,
        )
      : new StubMetaClient();
  }
  return singleton;
}

/** За тестови: инјектирај/ресетирај го клиентот. */
export function setMetaClient(client: MetaClient | null): void {
  singleton = client;
}
