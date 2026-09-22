import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { cleanupMonth } from './helpers.js';

/** Promotion (A6): одлука органски/платено ја отклучува analitika→zavrseno (G_DECISION). */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const MONTH = '2027-05';

let clientId = '';
let taskId = '';
let publicationId = '';
const token: Record<string, string> = {};

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}
const bearer = (role: string) => ({ Authorization: `Bearer ${token[role]}` });

beforeAll(async () => {
  token.ana = await login('vane@godigital.mk');
  token.mon = await login('dejan@godigital.mk');

  const client = await db.client.findFirst({ where: { name: 'Ресторан ИВ' } });
  clientId = client!.id;

  await cleanupMonth(db, MONTH);
  const group = await db.taskGroup.create({
    data: {
      clientId,
      contentType: 'graphic',
      monthKey: MONTH,
      status: 'zatvoren',
      plannedCount: 4,
    },
  });
  const task = await db.task.create({
    data: {
      groupId: group.id,
      clientId,
      contentType: 'graphic',
      title: 'Аналитика таск',
      status: 'analitika',
    },
  });
  taskId = task.id;
  const pub = await db.publication.create({
    data: { taskId, platform: 'ig', postType: 'post', permalink: 'https://instagram.com/p/promoX' },
  });
  publicationId = pub.id;
});

describe('Promotion (A6)', () => {
  it('analitika→zavrseno без одлука → GUARD_FAILED (decision)', async () => {
    const r = await request(app)
      .post(`/api/tasks/${taskId}/transition`)
      .set(bearer('ana'))
      .send({ to: 'zavrseno' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('GUARD_FAILED');
    expect(r.body.details.missing).toContain('decision');
  });

  it('погрешна улога (mon) на промоција → 403', async () => {
    const r = await request(app)
      .post(`/api/publications/${publicationId}/promotion`)
      .set(bearer('mon'))
      .send({ decision: 'paid' });
    expect(r.status).toBe(403);
  });

  it('внес на одлука → 200, потоа analitika→zavrseno поминува', async () => {
    const promo = await request(app)
      .post(`/api/publications/${publicationId}/promotion`)
      .set(bearer('ana'))
      .send({ decision: 'paid', rationale: 'Добар reach.' });
    expect(promo.status).toBe(200);
    expect(promo.body.data.decision).toBe('paid');

    const done = await request(app)
      .post(`/api/tasks/${taskId}/transition`)
      .set(bearer('ana'))
      .send({ to: 'zavrseno' });
    expect(done.status).toBe(200);
    expect(done.body.data.status).toBe('zavrseno');
  });
});
