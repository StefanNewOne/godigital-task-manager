import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';

/**
 * Парче 1 (редизајн): Директор гаси клиент → датумите може да се закажат/активираат само до
 * крај на месецот на гасењето. Наредните месеци се блокирани (CLIENT_DEACTIVATED).
 */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';

let clientId = '';
let dirToken = '';
let amToken = '';

const now = new Date();
const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 15));
const nextMonthKey = `${nextMonth.getUTCFullYear()}-${String(nextMonth.getUTCMonth() + 1).padStart(2, '0')}`;

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}

async function cleanupClientNextMonth() {
  const groups = await db.taskGroup.findMany({
    where: { clientId, monthKey: nextMonthKey },
    select: { id: true },
  });
  const gids = groups.map((g) => g.id);
  if (gids.length) {
    await db.task.deleteMany({ where: { groupId: { in: gids } } });
    await db.taskGroup.deleteMany({ where: { id: { in: gids } } });
  }
  await db.publishingSlot.deleteMany({ where: { clientId, monthKey: nextMonthKey } });
}

beforeAll(async () => {
  dirToken = await login('aleks@godigital.mk');
  amToken = await login('tamara@godigital.mk');
  const client = await db.client.findFirst({
    where: { name: { not: 'Ресторан ИВ' }, archivedAt: null },
    orderBy: { name: 'asc' },
  });
  clientId = client!.id;
  await db.client.update({ where: { id: clientId }, data: { deactivatedAt: null } });
  await cleanupClientNextMonth();
});

afterAll(async () => {
  // Врати чиста состојба (клиентот е споделен со други тестови).
  await db.client.update({ where: { id: clientId }, data: { deactivatedAt: null } });
  await cleanupClientNextMonth();
  await db.$disconnect();
});

describe('Директор гаси/пали клиент (Парче 1)', () => {
  it('само Директор може да деактивира (АМ добива 403)', async () => {
    const r = await request(app)
      .post(`/api/clients/${clientId}/deactivate`)
      .set({ Authorization: `Bearer ${amToken}` });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('Директор деактивира → deactivatedAt сетиран + EventLog', async () => {
    const r = await request(app)
      .post(`/api/clients/${clientId}/deactivate`)
      .set({ Authorization: `Bearer ${dirToken}` });
    expect(r.status).toBe(200);
    expect(r.body.data.deactivatedAt).toBeTruthy();

    const client = await db.client.findUnique({ where: { id: clientId } });
    expect(client!.deactivatedAt).not.toBeNull();
    const ev = await db.eventLog.findFirst({
      where: { objectType: 'client', objectId: clientId, eventType: 'client.deactivated' },
    });
    expect(ev).not.toBeNull();
  });

  it('екстра таск во нареден месец е блокиран (CLIENT_DEACTIVATED)', async () => {
    const r = await request(app)
      .post('/api/tasks/extra')
      .set({ Authorization: `Bearer ${dirToken}` })
      .send({
        clientId,
        contentType: 'video',
        title: 'Интервентно видео',
        date: nextMonth.toISOString(),
      });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('CLIENT_DEACTIVATED');
  });

  it('по реактивација, нареден месец е повторно дозволен', async () => {
    const back = await request(app)
      .post(`/api/clients/${clientId}/reactivate`)
      .set({ Authorization: `Bearer ${dirToken}` });
    expect(back.status).toBe(200);
    expect(back.body.data.deactivatedAt).toBeNull();

    const r = await request(app)
      .post('/api/tasks/extra')
      .set({ Authorization: `Bearer ${dirToken}` })
      .send({
        clientId,
        contentType: 'video',
        title: 'Интервентно видео',
        date: nextMonth.toISOString(),
      });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('chekaRezija');
  });
});
