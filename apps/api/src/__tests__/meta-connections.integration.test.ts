import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { setMetaClient } from '../services/meta/metaClient.js';
import { StubMetaClient } from '../services/meta/metaClient.stub.js';
import { syncConnections } from '../services/meta/sync.js';

/** Модул 3 · Мета — MF3: „Поврзувања" (токен-статус без вредности §12 + конекции). */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const NAME = 'ТЕСТ Meta Connections';
let clientId = '';
let dir = '';
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
      metaPageId: 'page_stub_1',
      metaIgId: 'ig_stub_1',
    },
  });
  clientId = c.id;
  await syncConnections();
});

afterAll(async () => {
  await cleanup();
  setMetaClient(null);
  await db.$disconnect();
});

describe('Meta · Поврзувања (MF3)', () => {
  it('dir → токен-картички + редови конекции', async () => {
    const r = await request(app).get('/api/meta/connections').set(auth(dir));
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data.tokens)).toBe(true);
    expect(r.body.data.tokens.length).toBeGreaterThanOrEqual(2);
    const row = r.body.data.rows.find((x: { clientId: string }) => x.clientId === clientId);
    expect(row).toBeTruthy();
    expect(row.adAccount).toBe('act_stub_1');
  });

  it('§12: токен-картичките НЕ содржат вредност на токен', async () => {
    const r = await request(app).get('/api/meta/connections').set(auth(dir));
    const serialized = JSON.stringify(r.body.data.tokens);
    // Само метаподатоци: name/configured/valid/expiresAt/scopes — никаков `token`/`value`/`secret`.
    expect(serialized).not.toMatch(/"token"|"value"|"secret"|"accessToken"/i);
    for (const tok of r.body.data.tokens) {
      expect(tok).toHaveProperty('name');
      expect(tok).toHaveProperty('scopes');
      expect(tok).not.toHaveProperty('token');
    }
  });

  it('am → 403 (Поврзувања е управувачки екран)', async () => {
    expect((await request(app).get('/api/meta/connections').set(auth(am))).status).toBe(403);
  });
});
