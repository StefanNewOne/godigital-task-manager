import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { env } from '../env.js';
import { cleanupMonth } from './helpers.js';

/** Интеграциски тест за B2.2: /analytics агрегација (по metrics.pull со stub). */
const app = createApp();
const db = new PrismaClient();
const MONTH = '2027-04';
let anaToken = '';
let monToken = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: 'gd-devpass-2026' });
  return r.body.data.accessToken as string;
}

beforeAll(async () => {
  anaToken = await login('vane@godigital.mk');
  monToken = await login('dejan@godigital.mk');

  await cleanupMonth(db, MONTH);
  const oldCamps = await db.campaign.findMany({
    where: { metaCampaignId: 'camp_analytics_1' },
    select: { id: true },
  });
  if (oldCamps.length) {
    const ids = oldCamps.map((c) => c.id);
    await db.metricSnapshot.deleteMany({ where: { campaignId: { in: ids } } });
    await db.campaign.deleteMany({ where: { id: { in: ids } } });
  }

  const client = await db.client.findFirst({ where: { status: 'aktiven', archivedAt: null } });
  const group = await db.taskGroup.create({
    data: { clientId: client!.id, contentType: 'graphic', monthKey: MONTH, status: 'zatvoren' },
  });
  const task = await db.task.create({
    data: {
      groupId: group.id,
      clientId: client!.id,
      contentType: 'graphic',
      title: 'analytics тест објава',
      status: 'objaveno',
    },
  });
  await db.publication.create({
    data: {
      taskId: task.id,
      platform: 'ig',
      postType: 'post',
      permalink: 'https://instagram.com/p/AnalyticsTest1',
      externalRef: 'AnalyticsTest1',
      resolveStatus: 'pending',
    },
  });
  await db.campaign.create({
    data: {
      clientId: client!.id,
      name: 'analytics тест кампања',
      objective: 'reach',
      budget: 800,
      periodFrom: new Date('2027-04-05'),
      periodTo: new Date('2027-04-25'),
      status: 'active',
      metaCampaignId: 'camp_analytics_1',
    },
  });

  // Наполни MetricSnapshot преку stub-от.
  await request(app).post('/api/cron/metrics-pull').set('x-cron-secret', env.CRON_SECRET).send({});
});

describe('B2.2 /analytics', () => {
  it('враќа агрегирани KPI, кампањи и топ објави за месецот', async () => {
    const r = await request(app)
      .get(`/api/analytics?month=${MONTH}`)
      .set({ Authorization: `Bearer ${anaToken}` });
    expect(r.status).toBe(200);
    const d = r.body.data;
    expect(d.hasData).toBe(true);
    expect(d.kpis.reach).toBeGreaterThan(0);
    expect(d.kpis.impressions).toBeGreaterThan(0);
    expect(d.kpis.posts).toBeGreaterThan(0);
    expect(d.kpis.spend).toBeGreaterThan(0);
    expect(d.campaigns.length).toBeGreaterThan(0);
    expect(d.topPosts.length).toBeGreaterThan(0);
    expect(d.topPosts[0].name).toContain('analytics тест објава');
  });

  it('улога без analytics екран → 403', async () => {
    const r = await request(app)
      .get(`/api/analytics?month=${MONTH}`)
      .set({ Authorization: `Bearer ${monToken}` });
    expect(r.status).toBe(403);
  });
});
