import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { setMetaClient } from '../services/meta/metaClient.js';
import { StubMetaClient } from '../services/meta/metaClient.stub.js';
import { syncConnections, syncStructureForClient } from '../services/meta/sync.js';

/** Модул 3 · Мета — М6: AI помошник (§11). Само чита + подготвува нацрт (не создава); read → refuse. */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const NAME = 'ТЕСТ Meta Assistant';
const NAME_RO = 'ТЕСТ Meta Assistant RO';
let clientId = '';
let roClientId = '';
let dir = '';
let am = '';

const login = async (email: string) =>
  (await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD })).body.data
    .accessToken as string;
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const chat = (token: string, message: string, cid?: string) =>
  request(app).post('/api/meta/assistant/chat').set(auth(token)).send({ message, clientId: cid });

async function cleanupByName(name: string) {
  const clients = await db.client.findMany({ where: { name } });
  for (const c of clients) {
    await db.metaChangePlan.deleteMany({ where: { clientId: c.id } });
    await db.metaConnection.deleteMany({ where: { clientId: c.id } });
    await db.client.delete({ where: { id: c.id } });
  }
}

beforeAll(async () => {
  setMetaClient(new StubMetaClient());
  dir = await login('aleks@godigital.mk');
  am = await login('tamara@godigital.mk');
  await cleanupByName(NAME);
  await cleanupByName(NAME_RO);
  const c = await db.client.create({
    data: {
      name: NAME,
      color: '#0866FF',
      contractStart: new Date(Date.UTC(2035, 0, 1)),
      contractMonths: 12,
      usesMetaAds: true,
      metaAdAccountId: 'act_stub_1',
      metaMaxDailyBudget: 500,
    },
  });
  clientId = c.id;
  await syncConnections();
  await syncStructureForClient(clientId);

  // Клиент со рекламна сметка само за читање.
  const ro = await db.client.create({
    data: {
      name: NAME_RO,
      color: '#0866FF',
      contractStart: new Date(Date.UTC(2035, 0, 1)),
      contractMonths: 12,
      usesMetaAds: true,
      metaAdAccountId: 'act_stub_2',
    },
  });
  roClientId = ro.id;
  await db.metaConnection.create({
    data: { clientId: roClientId, kind: 'adAccount', metaId: 'act_stub_2', accessLevel: 'read' },
  });
});

afterAll(async () => {
  await cleanupByName(NAME);
  await cleanupByName(NAME_RO);
  setMetaClient(null);
  await db.$disconnect();
});

describe('Meta AI помошник (М6)', () => {
  it('am → 403', async () => {
    expect((await chat(am, 'преглед')).status).toBe(403);
  });

  it('буџет → нацрт-план (не создава MetaChangePlan)', async () => {
    const before = await db.metaChangePlan.count({ where: { clientId } });
    const r = await chat(dir, 'зголеми буџет на 200', clientId);
    expect(r.status).toBe(200);
    expect(r.body.data.draft).toBeTruthy();
    expect(r.body.data.draft.op).toBe('O2');
    expect(r.body.data.draft.params.amount).toBe(200);
    expect(r.body.data.draft.after).toEqual({ dailyBudget: 200 });
    expect(r.body.data.refused).toBe(false);
    // Не смее да создаде план.
    expect(await db.metaChangePlan.count({ where: { clientId } })).toBe(before);
  });

  it('буџет без избран клиент → бара клиент', async () => {
    const r = await chat(dir, 'буџет 100');
    expect(r.body.data.draft).toBeNull();
    expect(r.body.data.answer).toContain('клиент');
  });

  it('read-only сметка → одбива да подготви план', async () => {
    const r = await chat(dir, 'буџет 300', roClientId);
    expect(r.body.data.refused).toBe(true);
    expect(r.body.data.draft).toBeNull();
  });

  it('алерти → чита (без нацрт)', async () => {
    const r = await chat(dir, 'има ли алерти', clientId);
    expect(r.status).toBe(200);
    expect(r.body.data.draft).toBeNull();
    expect(r.body.data.toolsUsed).toContain('get_alerts');
  });

  it('преглед → get_overview', async () => {
    const r = await chat(dir, 'дај ми преглед');
    expect(r.body.data.toolsUsed).toContain('get_overview');
  });

  it('празна порака → 400', async () => {
    expect((await chat(dir, '   ')).status).toBe(400);
  });
});
