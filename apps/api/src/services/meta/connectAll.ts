import { prisma } from '../../db/tenantExtension.js';
import { syncConnections, syncStructureForClient } from './sync.js';
import {
  backfillClientMedia,
  backfillClientPage,
  backfillClientCampaigns,
  pullMetrics,
} from './metrics.js';

/**
 * Модул 3 · Мета — „Поврзи ги сите клиенти" (одлука 2026-10-02). Еден клик: создади/освежи
 * `MetaConnection` за СЕКОЈ активен клиент со доделен Meta ID (Page/Ad-account/IG) + backfill
 * (органски постови, кампањи, page метрики) + повлечи снапшоти. Best-effort по клиент — грешка
 * на еден не ја паѓа целата операција. Само читање од Meta (никогаш не пишува, D1).
 */
export interface ConnectResult {
  clientId: string;
  name: string;
  connections: number;
  error: string | null;
}

export async function connectAllClients(): Promise<{ clients: number; results: ConnectResult[] }> {
  // 1) Рекламни сметки (со детали: валута, spend cap, статус) за ads клиентите.
  await syncConnections();

  // 2) Страница + IG за СИТЕ активни клиенти со тие ID-а (вклучувајќи не-ads клиенти).
  const clients = await prisma.client.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, metaPageId: true, metaAdAccountId: true, metaIgId: true },
  });

  const results: ConnectResult[] = [];
  for (const c of clients) {
    if (!c.metaPageId && !c.metaAdAccountId && !c.metaIgId) continue; // не-доделен → прескокни

    const r: ConnectResult = { clientId: c.id, name: c.name, connections: 0, error: null };

    // Врски (page/ig) — овие мора да успеат за да се смета клиентот поврзан.
    const pageIg = [
      ['page', c.metaPageId],
      ['igAccount', c.metaIgId],
    ] as const;
    for (const [kind, metaId] of pageIg) {
      if (!metaId) continue;
      await prisma.metaConnection.upsert({
        where: { clientId_kind_metaId: { clientId: c.id, kind, metaId } },
        create: { clientId: c.id, kind, metaId, lastSyncAt: new Date() },
        update: { lastSyncAt: new Date(), lastSyncError: null, syncFailCount: 0 },
      });
    }
    r.connections = await prisma.metaConnection.count({ where: { clientId: c.id } });

    // Backfill (best-effort) — грешка тука не ја поништува врската, само се бележи.
    try {
      if (c.metaPageId) await backfillClientPage(c.id);
      if (c.metaAdAccountId) {
        await syncStructureForClient(c.id);
        await backfillClientCampaigns(c.id, 50);
      }
      if (c.metaPageId || c.metaIgId) await backfillClientMedia(c.id, 25);
    } catch (e) {
      r.error = e instanceof Error ? e.message : 'грешка при backfill';
    }
    results.push(r);
  }

  // 3) Снапшоти на метрики (кампањи веќе backfill-ирани — избегни дупли).
  await pullMetrics({ mediaOnly: true });

  return { clients: results.length, results };
}
