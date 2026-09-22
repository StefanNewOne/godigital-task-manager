import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient, type ContentType, type TaskStatus } from '@gd/db';
import { createApp } from '../app.js';
import { cleanupMonth } from './helpers.js';

/** Интеграциски тест за специјалните преоди (A3): пауза / откажување / враќање + E_RELEASE_SLOT. */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const MONTH = '2027-11';

let clientId = '';
let groupId = '';
const token: Record<string, string> = {};

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}

const bearer = (role: string) => ({ Authorization: `Bearer ${token[role]}` });

/** Создади слот + таск врзан на него; враќа {taskId, slotId}. */
async function mkTaskWithSlot(
  status: TaskStatus,
  contentType: ContentType,
  day: number,
): Promise<{ taskId: string; slotId: string }> {
  const slot = await db.publishingSlot.create({
    data: {
      clientId,
      contentType,
      date: new Date(Date.UTC(2027, 10, day)),
      orderInDay: 1,
      status: 'reserved',
      monthKey: MONTH,
    },
  });
  const task = await db.task.create({
    data: { groupId, clientId, contentType, title: `тест ${status}`, status, slotId: slot.id },
  });
  return { taskId: task.id, slotId: slot.id };
}

beforeAll(async () => {
  token.dir = await login('aleks@godigital.mk');
  token.am = await login('tamara@godigital.mk');
  token.mon = await login('dejan@godigital.mk');

  const client = await db.client.findFirst({ where: { name: 'Ресторан ИВ' } });
  clientId = client!.id;

  await cleanupMonth(db, MONTH);
  groupId = (
    await db.taskGroup.create({
      data: {
        clientId,
        contentType: 'graphic',
        monthKey: MONTH,
        status: 'zatvoren',
        plannedCount: 8,
      },
    })
  ).id;
});

describe('Специјални преоди (A3)', () => {
  it('пауза (am) го памти статусот, го ослободува слотот', async () => {
    const { taskId, slotId } = await mkTaskWithSlot('dizajn', 'graphic', 3);
    const r = await request(app)
      .post(`/api/tasks/${taskId}/pause`)
      .set(bearer('am'))
      .send({ reason: 'Клиентот бара пауза.' });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('pauza');
    expect(r.body.data.pausedFromStatus).toBe('dizajn');
    expect(r.body.data.slotId).toBeNull();
    const slot = await db.publishingSlot.findUnique({ where: { id: slotId } });
    expect(slot!.status).toBe('free');
  });

  it('пауза без причина → 400 (Zod)', async () => {
    const { taskId } = await mkTaskWithSlot('dizajn', 'graphic', 4);
    const r = await request(app).post(`/api/tasks/${taskId}/pause`).set(bearer('am')).send({});
    expect(r.status).toBe(400);
  });

  it('пауза од погрешна улога (mon) → 403', async () => {
    const { taskId } = await mkTaskWithSlot('dizajn', 'graphic', 5);
    const r = await request(app)
      .post(`/api/tasks/${taskId}/pause`)
      .set(bearer('mon'))
      .send({ reason: 'x' });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('враќање од пауза зема нов слот и го враќа статусот', async () => {
    const { taskId } = await mkTaskWithSlot('montaza', 'graphic', 6);
    await request(app)
      .post(`/api/tasks/${taskId}/pause`)
      .set(bearer('am'))
      .send({ reason: 'пауза' });
    const r = await request(app)
      .post(`/api/tasks/${taskId}/resume`)
      .set(bearer('am'))
      .send({ newDate: '2027-11-20' });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('montaza');
    expect(r.body.data.pausedFromStatus).toBeNull();
    expect(r.body.data.slotId).not.toBeNull();
    const slot = await db.publishingSlot.findUnique({ where: { id: r.body.data.slotId } });
    expect(slot!.status).toBe('reserved');
  });

  it('враќање со датум во минато → 400 DATE_IN_PAST', async () => {
    const { taskId } = await mkTaskWithSlot('dizajn', 'graphic', 7);
    await request(app).post(`/api/tasks/${taskId}/pause`).set(bearer('am')).send({ reason: 'п' });
    const r = await request(app)
      .post(`/api/tasks/${taskId}/resume`)
      .set(bearer('am'))
      .send({ newDate: '2020-01-01' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('DATE_IN_PAST');
  });

  it('откажување (само dir) е терминално и го ослободува слотот', async () => {
    const { taskId, slotId } = await mkTaskWithSlot('dizajn', 'graphic', 8);
    const forbidden = await request(app)
      .post(`/api/tasks/${taskId}/cancel`)
      .set(bearer('am'))
      .send({ reason: 'x' });
    expect(forbidden.status).toBe(403);

    const r = await request(app)
      .post(`/api/tasks/${taskId}/cancel`)
      .set(bearer('dir'))
      .send({ reason: 'Клиентот се откажа.' });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('otkazano');
    const slot = await db.publishingSlot.findUnique({ where: { id: slotId } });
    expect(slot!.status).toBe('free');
  });
});
