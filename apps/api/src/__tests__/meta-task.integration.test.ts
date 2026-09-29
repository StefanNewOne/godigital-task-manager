import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { setMetaClient } from '../services/meta/metaClient.js';
import { StubMetaClient } from '../services/meta/metaClient.stub.js';
import {
  syncConnections,
  syncInsightsForClient,
  syncStructureForClient,
} from '../services/meta/sync.js';
import { getTaskMeta, linkAdsToPublications } from '../services/meta/taskMeta.js';

/** Модул 3 · Мета — М3: врска Task↔Мета + метрики во таскот (§9.1). */
const db = new PrismaClient();
const NAME = 'ТЕСТ Meta Task';
const MEDIA = 'post_meta_task_1';
let clientId = '';
let taskId = '';

async function cleanup() {
  const clients = await db.client.findMany({ where: { name: NAME } });
  for (const c of clients) {
    const pubs = await db.publication.findMany({ where: { clientId: c.id } });
    for (const p of pubs) {
      await db.metricSnapshot.deleteMany({ where: { publicationId: p.id } });
      await db.promotion.deleteMany({ where: { publicationId: p.id } });
    }
    await db.publication.deleteMany({ where: { clientId: c.id } });
    await db.metaInsightDaily.deleteMany({ where: { clientId: c.id } });
    await db.metaConnection.deleteMany({ where: { clientId: c.id } }); // cascade → campaign/adset/ad
    await db.task.deleteMany({ where: { clientId: c.id } });
    await db.taskGroup.deleteMany({ where: { clientId: c.id } });
    await db.client.delete({ where: { id: c.id } });
  }
}

beforeAll(async () => {
  setMetaClient(new StubMetaClient());
  await cleanup();
  const c = await db.client.create({
    data: {
      name: NAME,
      color: '#0866FF',
      contractStart: new Date(Date.UTC(2035, 0, 1)),
      contractMonths: 12,
      usesMetaAds: true,
      metaAdAccountId: 'act_stub_1',
    },
  });
  clientId = c.id;

  await syncConnections();
  await syncStructureForClient(clientId);
  // Синхронизираната реклама добива sourcePostMetaId за да се врзе со објавата
  const ad = await db.metaAd.findFirst({ where: { adSet: { campaign: { clientId } } } });
  await db.metaAd.update({ where: { id: ad!.id }, data: { sourcePostMetaId: MEDIA } });
  await syncInsightsForClient(clientId, new Date().toISOString().slice(0, 10), false);

  const group = await db.taskGroup.create({
    data: { clientId, contentType: 'video', monthKey: '2035-06', status: 'podgotovka' },
  });
  const task = await db.task.create({
    data: { groupId: group.id, clientId, contentType: 'video', title: 'ТЕСТ', status: 'analitika' },
  });
  taskId = task.id;
  const pub = await db.publication.create({
    data: {
      taskId,
      clientId,
      platform: 'ig',
      postType: 'reel',
      metaMediaId: MEDIA,
      resolveStatus: 'resolved',
    },
  });
  await db.metricSnapshot.create({
    data: { publicationId: pub.id, raw: {}, views: 1000, reach: 800, engagement: 50 },
  });
  await linkAdsToPublications(clientId);
});

afterAll(async () => {
  await cleanup();
  setMetaClient(null);
  await db.$disconnect();
});

describe('GET task meta (М3)', () => {
  it('врзува реклама → објава преку sourcePostMetaId=metaMediaId', async () => {
    const ad = await db.metaAd.findFirst({ where: { sourcePostMetaId: MEDIA } });
    const pub = await db.publication.findFirst({ where: { metaMediaId: MEDIA } });
    expect(ad?.publicationId).toBe(pub!.id);
  });

  it('getTaskMeta враќа објава, органика, платено', async () => {
    const meta = await getTaskMeta(taskId);
    expect(meta.publication?.metaMediaId).toBe(MEDIA);
    expect(meta.organic?.views).toBe(1000);
    expect(meta.organic?.reach).toBe(800); // IG → reach се прикажува
    expect(meta.paid).toHaveLength(1);
    expect(meta.paid[0]!.spend).toBeGreaterThan(0);
    expect(meta.paid[0]!.currency).toBe('EUR');
    expect(meta.fbPerPostUnavailable).toBe(false);
  });

  it('FB објава: reach недостапно (v21)', async () => {
    const pub = await db.publication.findFirst({ where: { metaMediaId: MEDIA } });
    await db.publication.update({ where: { id: pub!.id }, data: { platform: 'fb' } });
    const meta = await getTaskMeta(taskId);
    expect(meta.fbPerPostUnavailable).toBe(true);
    expect(meta.organic?.reach).toBeNull();
    await db.publication.update({ where: { id: pub!.id }, data: { platform: 'ig' } });
  });
});
