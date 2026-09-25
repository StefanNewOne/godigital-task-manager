import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';

/** Интеграциски тест: Web Push претплати (C5). */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const ENDPOINT = 'https://fcm.googleapis.com/fcm/send/gd-test-endpoint-c5';

let token = '';

beforeAll(async () => {
  const r = await request(app)
    .post('/api/auth/login')
    .send({ email: 'stefan@godigital.mk', password: DEV_PASSWORD });
  token = r.body.data.accessToken;
  await db.pushSubscription.deleteMany({ where: { endpoint: ENDPOINT } });
});

afterAll(async () => {
  await db.pushSubscription.deleteMany({ where: { endpoint: ENDPOINT } });
});

describe('Web Push (C5)', () => {
  it('public-key враќа стринг или null', async () => {
    const r = await request(app)
      .get('/api/push/public-key')
      .set({ Authorization: `Bearer ${token}` });
    expect(r.status).toBe(200);
    expect('key' in r.body.data).toBe(true);
  });

  it('subscribe создава претплата, unsubscribe ја брише', async () => {
    const sub = await request(app)
      .post('/api/push/subscribe')
      .set({ Authorization: `Bearer ${token}` })
      .send({ endpoint: ENDPOINT, keys: { p256dh: 'p256-key', auth: 'auth-key' } });
    expect(sub.status).toBe(201);
    expect(await db.pushSubscription.count({ where: { endpoint: ENDPOINT } })).toBe(1);

    const un = await request(app)
      .post('/api/push/unsubscribe')
      .set({ Authorization: `Bearer ${token}` })
      .send({ endpoint: ENDPOINT });
    expect(un.status).toBe(200);
    expect(await db.pushSubscription.count({ where: { endpoint: ENDPOINT } })).toBe(0);
  });

  it('дупло subscribe (ист endpoint) → една претплата (upsert)', async () => {
    const body = { endpoint: ENDPOINT, keys: { p256dh: 'p1', auth: 'a1' } };
    await request(app)
      .post('/api/push/subscribe')
      .set({ Authorization: `Bearer ${token}` })
      .send(body);
    await request(app)
      .post('/api/push/subscribe')
      .set({ Authorization: `Bearer ${token}` })
      .send(body);
    expect(await db.pushSubscription.count({ where: { endpoint: ENDPOINT } })).toBe(1);
  });
});
