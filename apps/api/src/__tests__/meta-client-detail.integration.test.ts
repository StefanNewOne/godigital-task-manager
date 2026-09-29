import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { setMetaClient } from '../services/meta/metaClient.js';
import { StubMetaClient } from '../services/meta/metaClient.stub.js';
import { syncConnections, syncStructureForClient } from '../services/meta/sync.js';

/** Модул 3 · Мета — MF2: „Мета · Клиент" (Профил GET/PATCH + Органика). */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const NAME = 'ТЕСТ Meta Client Detail';
let clientId = '';
let dir = '';
let ana = '';
let am = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD })).body.data
    .accessToken as string;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

async function cleanup() {
  const clients = await db.client.findMany({ where: { name: NAME } });
  for (const c of clients) {
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
      metaIgId: 'ig_stub_1',
      metaMaxDailyBudget: 400,
    },
  });
  clientId = c.id;
  await syncConnections();
  await syncStructureForClient(clientId);
});

afterAll(async () => {
  await cleanup();
  setMetaClient(null);
  await db.$disconnect();
});

describe('Meta · Клиент детал (MF2)', () => {
  it('профил: GET (dir/ana) враќа цели/прагови + access', async () => {
    const r = await request(app).get(`/api/meta/clients/${clientId}/profile`).set(auth(ana));
    expect(r.status).toBe(200);
    expect(r.body.data.name).toBe(NAME);
    expect(r.body.data.profile.maxDailyBudget).toBe(400);
    expect(r.body.data).toHaveProperty('accessLevel');
  });

  it('профил: PATCH само dir; ana → 403', async () => {
    expect(
      (
        await request(app)
          .patch(`/api/meta/clients/${clientId}/profile`)
          .set(auth(ana))
          .send({ notes: 'x' })
      ).status,
    ).toBe(403);
    const ok = await request(app)
      .patch(`/api/meta/clients/${clientId}/profile`)
      .set(auth(dir))
      .send({ notes: 'Тест белешка', maxDailyBudget: 500, cprAlertPct: 50 });
    expect(ok.status).toBe(200);
    const after = await request(app).get(`/api/meta/clients/${clientId}/profile`).set(auth(dir));
    expect(after.body.data.profile.notes).toBe('Тест белешка');
    expect(after.body.data.profile.maxDailyBudget).toBe(500);
    expect(after.body.data.profile.cprAlertPct).toBe(50);
  });

  it('органика: GET враќа connected + totals + posts', async () => {
    const r = await request(app)
      .get(`/api/meta/clients/${clientId}/organic?period=30`)
      .set(auth(dir));
    expect(r.status).toBe(200);
    expect(r.body.data.connected).toBe(true);
    expect(r.body.data.totals).toHaveProperty('posts');
    expect(Array.isArray(r.body.data.posts)).toBe(true);
  });

  it('am → 403 на профил и органика', async () => {
    expect(
      (await request(app).get(`/api/meta/clients/${clientId}/profile`).set(auth(am))).status,
    ).toBe(403);
    expect(
      (await request(app).get(`/api/meta/clients/${clientId}/organic`).set(auth(am))).status,
    ).toBe(403);
  });

  it('meta.profile.updated настан е во архивата', async () => {
    const r = await request(app).get(`/api/meta/archive?clientId=${clientId}`).set(auth(dir));
    expect(
      r.body.data.some((e: { eventType: string }) => e.eventType === 'meta.profile.updated'),
    ).toBe(true);
  });
});
