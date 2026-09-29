import crypto from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';

// Мора да се постави ПРЕД да се вчита env.ts (преку динамички import на app.js подолу).
process.env.META_APP_SECRET = 'test-webhook-secret';
process.env.META_WEBHOOK_VERIFY_TOKEN = 'test-verify-token';

// Динамички import за да env.ts го прочита горното.
const { createApp } = await import('../app.js');
const { setMetaClient } = await import('../services/meta/metaClient.js');
const { StubMetaClient } = await import('../services/meta/metaClient.stub.js');
const { syncConnections, syncStructureForClient } = await import('../services/meta/sync.js');

/** Модул 3 · Мета — М4b: webhooks (verify handshake + потпис + read-only sync по настан). */
const app = createApp();
const db = new PrismaClient();
const NAME = 'ТЕСТ Meta Webhook';
let clientId = '';
let pageMetaId = '';

async function cleanup() {
  const clients = await db.client.findMany({ where: { name: NAME } });
  for (const c of clients) {
    const convos = await db.metaConversation.findMany({ where: { clientId: c.id } });
    for (const cv of convos) await db.metaMessage.deleteMany({ where: { conversationId: cv.id } });
    await db.metaConversation.deleteMany({ where: { clientId: c.id } });
    await db.metaComment.deleteMany({ where: { clientId: c.id } });
    await db.metaConnection.deleteMany({ where: { clientId: c.id } });
    await db.client.delete({ where: { id: c.id } });
  }
}

function sign(body: string) {
  return 'sha256=' + crypto.createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');
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
      metaPageId: 'page_stub_1',
      metaIgId: 'ig_stub_1',
    },
  });
  clientId = c.id;
  await syncConnections();
  await syncStructureForClient(clientId);
  const conn = await db.metaConnection.findFirst({ where: { clientId, kind: 'page' } });
  pageMetaId = conn!.metaId;
});

afterAll(async () => {
  await cleanup();
  setMetaClient(null);
  await db.$disconnect();
});

describe('Meta webhook (М4b)', () => {
  it('GET verify враќа challenge при точен токен', async () => {
    const r = await request(app).get('/api/webhooks/meta').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'test-verify-token',
      'hub.challenge': '123456',
    });
    expect(r.status).toBe(200);
    expect(r.text).toBe('123456');
  });

  it('GET verify одбива при погрешен токен', async () => {
    const r = await request(app).get('/api/webhooks/meta').query({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong',
      'hub.challenge': '123456',
    });
    expect(r.status).toBe(403);
  });

  it('POST без потпис → 403', async () => {
    const r = await request(app)
      .post('/api/webhooks/meta')
      .set('Content-Type', 'application/json')
      .send({ object: 'page', entry: [] });
    expect(r.status).toBe(403);
  });

  it('POST со невалиден потпис → 403', async () => {
    const r = await request(app)
      .post('/api/webhooks/meta')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', 'sha256=deadbeef')
      .send({ object: 'page', entry: [] });
    expect(r.status).toBe(403);
  });

  it('POST со валиден потпис → 200 + повлекува разговори (read-only)', async () => {
    const payload = JSON.stringify({
      object: 'page',
      entry: [{ id: pageMetaId, time: 1, messaging: [{ sender: { id: 'x' } }] }],
    });
    const r = await request(app)
      .post('/api/webhooks/meta')
      .set('Content-Type', 'application/json')
      .set('x-hub-signature-256', sign(payload))
      .send(payload);
    expect(r.status).toBe(200);
    // handlePayload е fire-and-forget → почекај да заврши повлекувањето.
    await new Promise((res) => setTimeout(res, 500));
    const convos = await db.metaConversation.findMany({ where: { clientId } });
    expect(convos.length).toBeGreaterThan(0);
  });
});
