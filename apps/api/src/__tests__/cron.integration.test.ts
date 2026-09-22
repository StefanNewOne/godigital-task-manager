import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { env } from '../env.js';
import { cleanupMonth } from './helpers.js';

/** Интеграциски тест за A2 cron: генерирање слотови за сите активни клиенти. */
const app = createApp();
const db = new PrismaClient();
const TEST_MONTH = '2026-12';

beforeAll(async () => {
  await cleanupMonth(db, TEST_MONTH);
});

describe('A2 cron slots-generate', () => {
  it('без токен → 403', async () => {
    const r = await request(app).post('/api/cron/slots-generate').send({ month: TEST_MONTH });
    expect(r.status).toBe(403);
  });

  it('со CRON_SECRET генерира за сите активни клиенти', async () => {
    const r = await request(app)
      .post('/api/cron/slots-generate')
      .set('x-cron-secret', env.CRON_SECRET)
      .send({ month: TEST_MONTH });
    expect(r.status).toBe(200);
    expect(r.body.data.month).toBe(TEST_MONTH);
    expect(r.body.data.clients).toBeGreaterThanOrEqual(6);

    const created = await db.publishingSlot.count({ where: { monthKey: TEST_MONTH } });
    expect(created).toBeGreaterThan(0);
  });
});
