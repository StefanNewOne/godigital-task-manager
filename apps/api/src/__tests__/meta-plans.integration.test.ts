import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { setMetaClient } from '../services/meta/metaClient.js';
import { StubMetaClient } from '../services/meta/metaClient.stub.js';
import { syncConnections, syncStructureForClient } from '../services/meta/sync.js';
import { confirmPlansOnSync, evaluatePlanMismatch } from '../services/meta/plans.js';

/** Модул 3 · Мета — М5: планови (create/approve/reject/mark-done/withdraw) + confirm-on-sync + архива. */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const NAME = 'ТЕСТ Meta Plans';
let clientId = '';
let campaignMetaId = '';
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
    await db.metaChangePlan.deleteMany({ where: { clientId: c.id } });
    // Каскада: бришењето на connection ги брише campaign→adset→ad.
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
      metaMaxDailyBudget: 500,
    },
  });
  clientId = c.id;
  await syncConnections();
  await syncStructureForClient(clientId);
  const camp = await db.metaCampaign.findFirst({ where: { clientId } });
  campaignMetaId = camp!.metaId;
});

afterAll(async () => {
  await cleanup();
  setMetaClient(null);
  await db.$disconnect();
});

describe('Meta планови (М5)', () => {
  it('dir создава → approved; ana создава → pending', async () => {
    const rd = await request(app)
      .post('/api/meta/plans')
      .set(auth(dir))
      .send({
        op: 'O2',
        clientId,
        target: { campaignId: campaignMetaId },
        params: { amount: 120 },
      });
    expect(rd.status).toBe(201);
    expect(rd.body.data.status).toBe('approved');
    expect(rd.body.data.consequences.length).toBeGreaterThan(0);

    const ra = await request(app)
      .post('/api/meta/plans')
      .set(auth(ana))
      .send({
        op: 'O2',
        clientId,
        target: { campaignId: campaignMetaId },
        params: { amount: 130 },
      });
    expect(ra.status).toBe(201);
    expect(ra.body.data.status).toBe('pending');
  });

  it('am нема пристап до /plans → 403', async () => {
    expect((await request(app).get('/api/meta/plans').set(auth(am))).status).toBe(403);
  });

  it('ana approve → 403 (само dir)', async () => {
    const p = await db.metaChangePlan.create({
      data: {
        clientId,
        op: 'O2',
        target: { campaignId: campaignMetaId },
        params: { amount: 140 },
        status: 'pending',
        createdById: (await db.employee.findFirst({ where: { email: 'vane@godigital.mk' } }))!.id,
      },
    });
    expect((await request(app).post(`/api/meta/plans/${p.id}/approve`).set(auth(ana))).status).toBe(
      403,
    );
  });

  it('reject без белешка → 422; со белешка → rejected', async () => {
    const p = await db.metaChangePlan.create({
      data: {
        clientId,
        op: 'O2',
        target: { campaignId: campaignMetaId },
        params: { amount: 150 },
        status: 'pending',
        createdById: (await db.employee.findFirst({ where: { email: 'aleks@godigital.mk' } }))!.id,
      },
    });
    expect((await request(app).post(`/api/meta/plans/${p.id}/reject`).set(auth(dir))).status).toBe(
      422,
    );
    const ok = await request(app)
      .post(`/api/meta/plans/${p.id}/reject`)
      .set(auth(dir))
      .send({ note: 'Премногу висок буџет.' });
    expect(ok.status).toBe(200);
    expect(ok.body.data.status).toBe('rejected');
    expect(ok.body.data.rejectNote).toBe('Премногу висок буџет.');
  });

  it('ana повлекува само свој pending; туѓ → 403', async () => {
    const anaId = (await db.employee.findFirst({ where: { email: 'vane@godigital.mk' } }))!.id;
    const dirId = (await db.employee.findFirst({ where: { email: 'aleks@godigital.mk' } }))!.id;
    const mine = await db.metaChangePlan.create({
      data: { clientId, op: 'O1', target: {}, status: 'pending', createdById: anaId },
    });
    const other = await db.metaChangePlan.create({
      data: { clientId, op: 'O1', target: {}, status: 'pending', createdById: dirId },
    });
    const okw = await request(app).post(`/api/meta/plans/${mine.id}/withdraw`).set(auth(ana));
    expect(okw.status).toBe(200);
    expect(okw.body.data.status).toBe('withdrawn');
    expect(
      (await request(app).post(`/api/meta/plans/${other.id}/withdraw`).set(auth(ana))).status,
    ).toBe(403);
  });

  it('approved → mark-done → syncing → confirm при совпаѓање → done', async () => {
    const created = await request(app)
      .post('/api/meta/plans')
      .set(auth(dir))
      .send({
        op: 'O2',
        clientId,
        target: { campaignId: campaignMetaId },
        params: { amount: 200 },
      });
    const id = created.body.data.id as string;
    expect(created.body.data.after).toEqual({ dailyBudget: 200 });

    const md = await request(app).post(`/api/meta/plans/${id}/mark-done`).set(auth(dir));
    expect(md.body.data.status).toBe('syncing');

    // Огледалото сè уште не се совпаѓа → без потврда.
    await db.metaCampaign.update({
      where: { metaId: campaignMetaId },
      data: { dailyBudget: 100 },
    });
    expect((await confirmPlansOnSync(clientId)).confirmed).toBe(0);

    // Симулирај рачна промена во Ads Manager → огледалото се совпаѓа → done.
    await db.metaCampaign.update({
      where: { metaId: campaignMetaId },
      data: { dailyBudget: 200 },
    });
    const r = await confirmPlansOnSync(clientId);
    expect(r.confirmed).toBeGreaterThanOrEqual(1);
    const done = await db.metaChangePlan.findUnique({ where: { id } });
    expect(done?.status).toBe('done');
    expect(done?.confirmedAt).toBeTruthy();
  });

  it('mismatch: syncing верификабилен план > 24 ч без совпаѓање → mismatch', async () => {
    const old = new Date();
    old.setUTCHours(old.getUTCHours() - 25);
    const p = await db.metaChangePlan.create({
      data: {
        clientId,
        op: 'O2',
        target: { campaignId: campaignMetaId },
        params: { amount: 999 },
        after: { dailyBudget: 999 },
        status: 'syncing',
        markedDoneAt: old,
        createdById: (await db.employee.findFirst({ where: { email: 'aleks@godigital.mk' } }))!.id,
      },
    });
    const r = await evaluatePlanMismatch();
    expect(r.flagged).toBeGreaterThanOrEqual(1);
    expect((await db.metaChangePlan.findUnique({ where: { id: p.id } }))?.status).toBe('mismatch');
  });

  it('архива: содржи meta.plan.* настани; am → 403', async () => {
    const r = await request(app).get(`/api/meta/archive?clientId=${clientId}`).set(auth(dir));
    expect(r.status).toBe(200);
    expect(
      r.body.data.some((e: { eventType: string }) => e.eventType.startsWith('meta.plan.')),
    ).toBe(true);
    expect((await request(app).get('/api/meta/archive').set(auth(am))).status).toBe(403);
  });
});
