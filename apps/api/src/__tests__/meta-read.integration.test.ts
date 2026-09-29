import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { setMetaClient } from '../services/meta/metaClient.js';
import { StubMetaClient } from '../services/meta/metaClient.stub.js';
import {
  syncConnections,
  syncInsightsForClient,
  syncStructureForClient,
} from '../services/meta/sync.js';

/** Модул 3 · Мета — М2c read API + пристап (dir/ana да, am не). */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const NAME = 'ТЕСТ Meta Read';
let clientId = '';
let dir = '';
let ana = '';
let am = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD })).body.data
    .accessToken as string;

async function cleanup() {
  const clients = await db.client.findMany({ where: { name: NAME } });
  for (const c of clients) {
    await db.metaInsightDaily.deleteMany({ where: { clientId: c.id } });
    await db.metaAlert.deleteMany({ where: { clientId: c.id } });
    await db.metaConnection.deleteMany({ where: { clientId: c.id } });
    await db.client.delete({ where: { id: c.id } });
  }
}

beforeAll(async () => {
  setMetaClient(new StubMetaClient());
  dir = await login('aleks@godigital.mk');
  ana = await login('vane@godigital.mk');
  am = await login('tamara@godigital.mk');
  await cleanup();
  const c = await db.client.create({
    data: {
      name: NAME,
      color: '#0866FF',
      contractStart: new Date(Date.UTC(2035, 0, 1)),
      contractMonths: 12,
      usesMetaAds: true,
      metaAdAccountId: 'act_stub_1',
      metaTargetText: '€0,80 по разговор',
    },
  });
  clientId = c.id;
  await syncConnections();
  await syncStructureForClient(clientId);
  await syncInsightsForClient(clientId, new Date().toISOString().slice(0, 10), false);
});

afterAll(async () => {
  await cleanup();
  setMetaClient(null);
  await db.$disconnect();
});

const get = (path: string, token: string) =>
  request(app)
    .get(path)
    .set({ Authorization: `Bearer ${token}` });

describe('Meta read API (М2c)', () => {
  it('overview: dir/ana да, am 403', async () => {
    expect((await get('/api/meta/overview', dir)).status).toBe(200);
    const r = await get('/api/meta/overview', ana);
    expect(r.status).toBe(200);
    expect(r.body.data.sync).toBeTruthy();
    expect(r.body.data.alerts).toBeTruthy();
    expect((await get('/api/meta/overview', am)).status).toBe(403);
  });

  it('clients: ред по клиент со кампањи/цел/валута', async () => {
    const r = await get('/api/meta/clients', ana);
    expect(r.status).toBe(200);
    const row = r.body.data.find((x: { id: string }) => x.id === clientId);
    expect(row.target).toBe('€0,80 по разговор');
    expect(row.campaigns).toBeGreaterThan(0);
    expect(row.currency).toBe('EUR');
  });

  it('cross: групирано по Objective (не собира различни)', async () => {
    const r = await get('/api/meta/cross?period=30', ana);
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data.groups)).toBe(true);
    // секоја група има еден Objective и е aggregatable
    for (const g of r.body.data.groups) expect(g.aggregatable).toBe(true);
  });

  it('structure: кампања → ad set → ад со KPI', async () => {
    const r = await get(`/api/meta/clients/${clientId}/structure?period=30`, ana);
    expect(r.status).toBe(200);
    const camp = r.body.data.campaigns[0];
    expect(camp.objectiveLabel).toBeTruthy();
    expect(camp.adSets[0].ads[0].kpi).toBeTruthy();
    expect(camp.adSets[0].ads[0]).toHaveProperty('reviewStatus');
  });

  it('alerts: список (dir/ana)', async () => {
    expect((await get('/api/meta/alerts', dir)).status).toBe(200);
    expect((await get('/api/meta/alerts', am)).status).toBe(403);
  });

  it('inbox/коментари: достапни и за am (М4b)', async () => {
    // am е заклучен од управувачките екрани, но ги гледа Инбокс + Коментари.
    expect((await get('/api/meta/conversations', am)).status).toBe(200);
    expect((await get('/api/meta/conversations', dir)).status).toBe(200);
    expect((await get('/api/meta/comments', am)).status).toBe(200);
    expect((await get('/api/meta/comments?filter=q', ana)).status).toBe(200);
  });

  it('refresh: dir → 202 (закажано, не блокира); am → 403 (MF1)', async () => {
    const r = await request(app)
      .post('/api/meta/refresh')
      .set({ Authorization: `Bearer ${dir}` })
      .send({ clientId });
    expect(r.status).toBe(202);
    expect(r.body.data.scheduled).toBe(true);
    const rAm = await request(app)
      .post('/api/meta/refresh')
      .set({ Authorization: `Bearer ${am}` });
    expect(rAm.status).toBe(403);
  });
});
