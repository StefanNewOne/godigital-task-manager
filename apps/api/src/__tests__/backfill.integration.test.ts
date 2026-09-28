import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { backfillClientMedia, pullMetrics } from '../services/meta/metrics.js';
import { getAnalytics } from '../services/analytics.js';
import { setMetaClient } from '../services/meta/metaClient.js';
import { StubMetaClient } from '../services/meta/metaClient.stub.js';

/**
 * B2 backfill: повлекување постови директно од IG-сметка → account-ниво Publication → метрики →
 * видливи во Аналитика. Со детерминистички stub Meta клиент.
 */
const db = new PrismaClient();
let clientId = '';

beforeAll(async () => {
  setMetaClient(new StubMetaClient());
  const c = await db.client.create({
    data: {
      name: 'ТЕСТ Backfill',
      color: '#A21CAF',
      contractStart: new Date(Date.UTC(2026, 0, 1)),
      contractMonths: 12,
      metaIgId: 'stub_ig_test',
    },
  });
  clientId = c.id;
});

afterAll(async () => {
  await db.publication.deleteMany({ where: { clientId } });
  await db.client.delete({ where: { id: clientId } });
  setMetaClient(null);
  await db.$disconnect();
});

describe('Meta backfill → Аналитика (B2)', () => {
  it('backfill создава account-ниво објави со resolved media id', async () => {
    const r = await backfillClientMedia(clientId, 3);
    expect(r.total).toBe(3);
    expect(r.created).toBe(3);

    const pubs = await db.publication.findMany({ where: { clientId, taskId: null } });
    expect(pubs.length).toBe(3);
    expect(pubs.every((p) => p.metaMediaId && p.resolveStatus === 'resolved')).toBe(true);
    expect(pubs.every((p) => p.publishedAt !== null)).toBe(true);
  });

  it('втор backfill е идемпотентен (update, не дупликат)', async () => {
    const r = await backfillClientMedia(clientId, 3);
    expect(r.created).toBe(0);
    expect(r.updated).toBe(3);
    const count = await db.publication.count({ where: { clientId, taskId: null } });
    expect(count).toBe(3);
  });

  it('pullMetrics создава snapshots + Аналитика ги вклучува account-објавите', async () => {
    await pullMetrics();
    // stub media се во далечен месец 2035-06 (без судир со demo дата) → сите се во topPosts.
    const a = await getAnalytics('2035-06');
    const mine = a.topPosts.filter((p) => p.name.includes('ТЕСТ Backfill'));
    expect(mine.length).toBeGreaterThan(0);
    expect(mine[0]!.reach).toBeGreaterThan(0);
    expect(a.hasData).toBe(true);
  });
});
