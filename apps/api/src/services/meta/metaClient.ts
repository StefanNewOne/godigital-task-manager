import { env } from '../../env.js';
import { StubMetaClient } from './metaClient.stub.js';
import { GraphMetaClient } from './metaClient.graph.js';

/** Минимален опис на објава потребен за резолуција на media id. */
export interface PublicationRef {
  platform: 'fb' | 'ig' | 'tiktok';
  externalRef: string | null;
  permalink: string | null;
}

/**
 * Адаптер кон Meta Graph API (B2). Враќа СУРОВ Graph одговор — нормализацијата ја прави
 * `@gd/core` (`normalizeMetaInsights`/`deriveMetrics`). Никогаш не се повикува од frontend.
 */
export interface MetaClient {
  /** Резолвирај го трајниот media id од објавата (PRD §4.8), или null ако не може. */
  resolveMediaId(pub: PublicationRef): Promise<string | null>;
  /** Суров insights одговор за органска медиа. */
  fetchMediaInsights(input: { platform: string; mediaId: string }): Promise<unknown>;
  /** Суров insights одговор за платена кампања. */
  fetchAdInsights(input: { metaCampaignId: string }): Promise<unknown>;
}

let singleton: MetaClient | null = null;

/**
 * Фабрика: реален Graph адаптер ако постои системски токен, инаку детерминистички stub
 * (dev/тест — целиот пајплајн работи без надворешни повици).
 */
export function getMetaClient(): MetaClient {
  if (!singleton) {
    singleton = env.META_SYSTEM_TOKEN
      ? new GraphMetaClient(env.META_SYSTEM_TOKEN, env.META_GRAPH_VERSION)
      : new StubMetaClient();
  }
  return singleton;
}

/** За тестови: инјектирај/ресетирај го клиентот. */
export function setMetaClient(client: MetaClient | null): void {
  singleton = client;
}
