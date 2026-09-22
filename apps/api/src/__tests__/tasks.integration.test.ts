import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { cleanupMonth } from './helpers.js';

/** Интеграциски тест за A3: листа со scope (И4), коментари/активност (D-9). */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const MONTH = '2027-02';

let clientId = '';
let monId = '';
let groupId = '';
const token: Record<string, string> = {};
let monTaskId = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}
const bearer = (role: string) => ({ Authorization: `Bearer ${token[role]}` });

beforeAll(async () => {
  token.dir = await login('aleks@godigital.mk');
  token.mon = await login('dejan@godigital.mk');
  monId = (await db.employee.findUnique({ where: { email: 'dejan@godigital.mk' } }))!.id;
  clientId = (await db.client.findFirst({ where: { name: 'Ресторан ИВ' } }))!.id;

  await cleanupMonth(db, MONTH);

  groupId = (
    await db.taskGroup.create({
      data: {
        clientId,
        contentType: 'video',
        monthKey: MONTH,
        status: 'zatvoren',
        plannedCount: 2,
      },
    })
  ).id;
  monTaskId = (
    await db.task.create({
      data: {
        groupId,
        clientId,
        contentType: 'video',
        title: 'Мон таск',
        status: 'montaza',
        assigneeId: monId,
      },
    })
  ).id;
  await db.task.create({
    data: { groupId, clientId, contentType: 'video', title: 'Реж таск', status: 'chekaRezija' },
  });
});

describe('A3 task list scope + activity', () => {
  it('Директор (scope all) ги гледа сите таскови за месецот', async () => {
    const r = await request(app).get(`/api/tasks?month=${MONTH}`).set(bearer('dir'));
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBe(2);
  });

  it('Монтажер (scope own) гледа само свои таскови', async () => {
    const r = await request(app).get(`/api/tasks?month=${MONTH}`).set(bearer('mon'));
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBe(1);
    expect(r.body.data[0].assigneeId).toBe(monId);
  });

  it('scope own не гледа туѓ таск преку /tasks/:id → 404', async () => {
    const other = await db.task.findFirst({
      where: { group: { monthKey: MONTH }, status: 'chekaRezija' },
    });
    const r = await request(app).get(`/api/tasks/${other!.id}`).set(bearer('mon'));
    expect(r.status).toBe(404);
  });

  it('коментар со @таг се појавува во активноста', async () => {
    const c = await request(app)
      .post(`/api/tasks/${monTaskId}/comments`)
      .set(bearer('dir'))
      .send({ body: 'Одлично изгледа.', mentions: [monId] });
    expect(c.status).toBe(201);

    const act = await request(app).get(`/api/tasks/${monTaskId}/activity`).set(bearer('dir'));
    expect(act.status).toBe(200);
    const texts = (act.body.data as Array<{ text: string }>).map((f) => f.text);
    expect(texts).toContain('Одлично изгледа.');
  });
});
