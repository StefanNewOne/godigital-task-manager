import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';

/**
 * Промена на датум (PRD §4, И5 „причина задолжителна", D-2). Ендпоинтот POST /tasks/:id/date-change
 * немаше интеграциски тест — ова го покрива: дозволи, задолжителна причина, минато, слот-резолуција,
 * DateChange запис + EventLog. Изолиран клиент/месец, чисти на крај.
 */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const MONTH = '2029-08';
const D1 = new Date(Date.UTC(2029, 7, 10)); // 10.08.2029 (почетен слот)
// Нов датум „2029-08-17" се праќа како стринг во барањата (иднина).

let clientId = '';
let groupId = '';
let slotAId = '';
let taskId = '';
const token: Record<string, string> = {};

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}
const bearer = (role: string) => ({ Authorization: `Bearer ${token[role]}` });

async function cleanup(): Promise<void> {
  const tasks = await db.task.findMany({ where: { groupId }, select: { id: true } });
  const ids = tasks.map((t) => t.id);
  if (ids.length) {
    await db.dateChange.deleteMany({ where: { taskId: { in: ids } } });
    await db.task.deleteMany({ where: { id: { in: ids } } });
  }
  await db.publishingSlot.deleteMany({ where: { monthKey: MONTH, clientId } });
  await db.taskGroup.deleteMany({ where: { id: groupId } });
}

beforeAll(async () => {
  token.dir = await login('aleks@godigital.mk');
  token.mon = await login('dejan@godigital.mk');
  const client = await db.client.findFirst({ where: { status: 'aktiven', archivedAt: null } });
  clientId = client!.id;

  groupId = (
    await db.taskGroup.create({
      data: { clientId, contentType: 'graphic', monthKey: MONTH, status: 'zatvoren' },
    })
  ).id;
  slotAId = (
    await db.publishingSlot.create({
      data: {
        clientId,
        contentType: 'graphic',
        date: D1,
        orderInDay: 1,
        status: 'reserved',
        monthKey: MONTH,
      },
    })
  ).id;
  taskId = (
    await db.task.create({
      data: {
        groupId,
        clientId,
        contentType: 'graphic',
        title: 'датум тест',
        status: 'brifing',
        slotId: slotAId,
        titleIsAuto: true,
      },
    })
  ).id;
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe('промена на датум (POST /tasks/:id/date-change)', () => {
  it('без причина → 400 VALIDATION_FAILED (И5)', async () => {
    const r = await request(app)
      .post(`/api/tasks/${taskId}/date-change`)
      .set(bearer('dir'))
      .send({ newDate: '2029-08-17' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('VALIDATION_FAILED');
  });

  it('датум во минато → 400 DATE_IN_PAST', async () => {
    const r = await request(app)
      .post(`/api/tasks/${taskId}/date-change`)
      .set(bearer('dir'))
      .send({ newDate: '2020-01-01', reason: 'тест' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('DATE_IN_PAST');
  });

  it('улога без дозвола за графика (mon) → 403 FORBIDDEN_ROLE', async () => {
    const r = await request(app)
      .post(`/api/tasks/${taskId}/date-change`)
      .set(bearer('mon'))
      .send({ newDate: '2029-08-17', reason: 'тест' });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('happy path (dir): слот се менува, DateChange + EventLog се создаваат, стар слот е free', async () => {
    const r = await request(app)
      .post(`/api/tasks/${taskId}/date-change`)
      .set(bearer('dir'))
      .send({ newDate: '2029-08-17', reason: 'Клиентот побара поместување.' });
    expect(r.status).toBe(200);
    expect(r.body.data.slotId).not.toBe(slotAId);

    const newSlot = await db.publishingSlot.findUnique({ where: { id: r.body.data.slotId } });
    expect(newSlot?.date.toISOString().slice(0, 10)).toBe('2029-08-17');
    expect(newSlot?.status).toBe('reserved');

    const oldSlot = await db.publishingSlot.findUnique({ where: { id: slotAId } });
    expect(oldSlot?.status).toBe('free');

    const dc = await db.dateChange.findFirst({ where: { taskId } });
    expect(dc?.reason).toBe('Клиентот побара поместување.');
    expect(dc?.changedByRole).toBe('dir');

    const ev = await db.eventLog.findFirst({
      where: { objectType: 'task', objectId: taskId, eventType: 'task.dateChanged' },
    });
    expect(ev).toBeTruthy();

    // titleIsAuto → насловот се регенерира за новиот датум (формат „· DD.MM").
    expect(r.body.data.title).toContain('17.08');
  });
});
