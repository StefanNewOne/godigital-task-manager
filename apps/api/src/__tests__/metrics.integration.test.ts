import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { env } from '../env.js';
import { cleanupMonth } from './helpers.js';

const MONTH = '2027-03';
const CAMP_REF = 'camp_test_1';

/** Интеграциски тест за B2.1: resolve + metrics.pull (stub адаптер) → MetricSnapshot. */
const app = createApp();
const db = new PrismaClient();

let clientId = '';
let pubId = '';
let campaignId = '';

const pull = () =>
  request(app).post('/api/cron/metrics-pull').set('x-cron-secret', env.CRON_SECRET).send({});

async function cleanupCampaign(ref: string): Promise<void> {
  const olds = await db.campaign.findMany({ where: { metaCampaignId: ref }, select: { id: true } });
  if (olds.length) {
    const ids = olds.map((o) => o.id);
    await db.metricSnapshot.deleteMany({ where: { campaignId: { in: ids } } });
    await db.campaign.deleteMany({ where: { id: { in: ids } } });
  }
}

beforeAll(async () => {
  await cleanupMonth(db, MONTH);
  await cleanupCampaign(CAMP_REF);
  const client = await db.client.findFirst({ where: { status: 'aktiven', archivedAt: null } });
  clientId = client!.id;
  const group = await db.taskGroup.create({
    data: { clientId, contentType: 'graphic', monthKey: MONTH, status: 'zatvoren' },
  });
  const task = await db.task.create({
    data: {
      groupId: group.id,
      clientId,
      contentType: 'graphic',
      title: 'metrics тест',
      status: 'objaveno',
    },
  });
  const pub = await db.publication.create({
    data: {
      taskId: task.id,
      platform: 'ig',
      postType: 'post',
      permalink: 'https://instagram.com/p/MetricsTest1',
      externalRef: 'MetricsTest1',
      resolveStatus: 'pending',
    },
  });
  pubId = pub.id;
  const campaign = await db.campaign.create({
    data: {
      clientId,
      name: 'metrics тест кампања',
      objective: 'reach',
      budget: 500,
      periodFrom: new Date('2027-03-01'),
      periodTo: new Date('2027-03-31'),
      status: 'active',
      metaCampaignId: CAMP_REF,
    },
  });
  campaignId = campaign.id;
});

describe('B2.1 metrics.pull (stub)', () => {
  it('резолвира media id и создава MetricSnapshot за објава', async () => {
    const r = await pull();
    expect(r.status).toBe(200);
    expect(r.body.data.resolved).toBeGreaterThan(0);
    expect(r.body.data.snapshots).toBeGreaterThan(0);

    const pub = await db.publication.findUnique({ where: { id: pubId } });
    expect(pub!.metaMediaId).toBe('stub_ig_MetricsTest1');
    expect(pub!.resolveStatus).toBe('resolved');

    const snap = await db.metricSnapshot.findFirst({
      where: { publicationId: pubId },
      orderBy: { capturedAt: 'desc' },
    });
    expect(snap).toBeTruthy();
    expect(Number(snap!.reach)).toBeGreaterThan(0);
    expect(Number(snap!.impressions)).toBeGreaterThan(0);
    // frequency = impressions/reach го пресметува core (deriveMetrics).
    expect(Number(snap!.frequency)).toBeGreaterThan(0);
  });

  it('создава MetricSnapshot за активна кампања (ad insights) со cpr', async () => {
    const snap = await db.metricSnapshot.findFirst({
      where: { campaignId },
      orderBy: { capturedAt: 'desc' },
    });
    expect(snap).toBeTruthy();
    expect(Number(snap!.spend)).toBeGreaterThan(0);
    expect(Number(snap!.cpr)).toBeGreaterThan(0);
  });

  it('append-only: втор пул додава нов snapshot (време-серија)', async () => {
    const before = await db.metricSnapshot.count({ where: { publicationId: pubId } });
    await pull();
    const after = await db.metricSnapshot.count({ where: { publicationId: pubId } });
    expect(after).toBe(before + 1);
  });

  it('без cron токен → 403', async () => {
    const r = await request(app).post('/api/cron/metrics-pull').send({});
    expect(r.status).toBe(403);
  });
});
