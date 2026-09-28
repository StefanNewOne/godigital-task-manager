import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';

/**
 * Парче 5 (редизайн): Режисер „Создај капа" — нормална видео капа во podgotovka, независно од
 * календарот. Само Режисер/Директор; една по (клиент, месец); блокирано за деактивиран период.
 */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const MONTH = '2032-05';

let rezToken = '';
let kreaToken = '';
let clientId = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}

beforeAll(async () => {
  rezToken = await login('stefan@godigital.mk');
  kreaToken = await login('ljubica@godigital.mk');
  const client = await db.client.create({
    data: {
      name: 'ТЕСТ Создај Капа',
      color: '#0EA5E9',
      contractStart: new Date(Date.UTC(2032, 0, 1)),
      contractMonths: 12,
      videosPerMonth: 4,
    },
  });
  clientId = client.id;
});

afterAll(async () => {
  await db.task.deleteMany({ where: { clientId } });
  await db.taskGroup.deleteMany({ where: { clientId } });
  await db.client.delete({ where: { id: clientId } });
  await db.$disconnect();
});

describe('Режисер „Создај капа" (Парче 5)', () => {
  it('Гр. креатор не може да создаде видео капа (403)', async () => {
    const r = await request(app)
      .post('/api/task-groups')
      .set({ Authorization: `Bearer ${kreaToken}` })
      .send({ clientId, month: MONTH });
    expect(r.status).toBe(403);
  });

  it('Режисер создава нормална видео капа во podgotovka', async () => {
    const r = await request(app)
      .post('/api/task-groups')
      .set({ Authorization: `Bearer ${rezToken}` })
      .send({ clientId, month: MONTH });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('podgotovka');
    expect(r.body.data.contentType).toBe('video');
    const rez = await db.employee.findFirst({ where: { role: 'rez' } });
    expect(r.body.data.rezId).toBe(rez!.id);
  });

  it('не дозволува втора видео капа за истиот месец (400)', async () => {
    const r = await request(app)
      .post('/api/task-groups')
      .set({ Authorization: `Bearer ${rezToken}` })
      .send({ clientId, month: MONTH });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('VALIDATION_FAILED');
  });

  it('деактивиран клиент → капа во иден месец блокирана (CLIENT_DEACTIVATED)', async () => {
    await db.client.update({
      where: { id: clientId },
      data: { deactivatedAt: new Date(Date.UTC(2032, 0, 20)) }, // cutoff јан 2032
    });
    const r = await request(app)
      .post('/api/task-groups')
      .set({ Authorization: `Bearer ${rezToken}` })
      .send({ clientId, month: '2032-09' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('CLIENT_DEACTIVATED');
    await db.client.update({ where: { id: clientId }, data: { deactivatedAt: null } });
  });
});
