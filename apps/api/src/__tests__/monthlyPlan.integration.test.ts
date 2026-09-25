import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { cleanupMonth } from './helpers.js';

/** Интеграциски тест: месечен план (одобрување од Директор) + мек гејт. */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const MONTH = '2027-02';

const token: Record<string, string> = {};
let astiboId = '';
let goldId = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}
const bearer = (role: string) => ({ Authorization: `Bearer ${token[role]}` });

async function clearPlan(): Promise<void> {
  await db.monthlyPlan.deleteMany({ where: { monthKey: MONTH } });
}

beforeAll(async () => {
  token.dir = await login('aleks@godigital.mk');
  token.rez = await login('stefan@godigital.mk');
  token.kam = await login('nikola@godigital.mk');
  astiboId = (await db.client.findFirst({ where: { name: 'Астибо' } }))!.id;
  goldId = (await db.client.findFirst({ where: { name: 'Голд Хотел' } }))!.id;
  await cleanupMonth(db, MONTH);
  await clearPlan();
});

afterAll(async () => {
  await cleanupMonth(db, MONTH);
  await clearPlan();
});

describe('Месечен план (Директор)', () => {
  it('GET нема план → сите клиенти active=true, непотврден', async () => {
    const r = await request(app).get(`/api/monthly-plan/${MONTH}`).set(bearer('dir'));
    expect(r.status).toBe(200);
    expect(r.body.data.confirmed).toBe(false);
    const astibo = r.body.data.clients.find((c: { clientId: string }) => c.clientId === astiboId);
    expect(astibo.active).toBe(true);
  });

  it('не-Директор не смее да уредува / потврдува → 403', async () => {
    const put = await request(app)
      .put(`/api/monthly-plan/${MONTH}`)
      .set(bearer('rez'))
      .send({ clients: [{ clientId: astiboId, active: true }] });
    expect(put.status).toBe(403);
    const conf = await request(app).post(`/api/monthly-plan/${MONTH}/confirm`).set(bearer('rez'));
    expect(conf.status).toBe(403);
  });

  it('PUT (Голд неактивен) + confirm → потврден', async () => {
    const put = await request(app)
      .put(`/api/monthly-plan/${MONTH}`)
      .set(bearer('dir'))
      .send({
        clients: [
          { clientId: astiboId, active: true },
          { clientId: goldId, active: false },
        ],
      });
    expect(put.status).toBe(200);
    const conf = await request(app).post(`/api/monthly-plan/${MONTH}/confirm`).set(bearer('dir'));
    expect(conf.status).toBe(200);
    expect(conf.body.data.confirmed).toBe(true);
  });

  it('гејт: неодобрен клиент → 400 MONTH_NOT_APPROVED; одобрен → 201', async () => {
    const blocked = await request(app)
      .post('/api/tasks/extra')
      .set(bearer('rez'))
      .send({ clientId: goldId, contentType: 'video', title: 'Гејт', date: `${MONTH}-20` });
    expect(blocked.status).toBe(400);
    expect(blocked.body.code).toBe('MONTH_NOT_APPROVED');

    const ok = await request(app)
      .post('/api/tasks/extra')
      .set(bearer('rez'))
      .send({ clientId: astiboId, contentType: 'video', title: 'Одобрен', date: `${MONTH}-20` });
    expect(ok.status).toBe(201);
    expect(ok.body.data.status).toBe('chekaRezija');
  });
});
