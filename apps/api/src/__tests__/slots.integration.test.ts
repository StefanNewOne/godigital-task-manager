import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';

/** Интеграциски тест за A2: слот генерирање → потврда → мртви таскови + автоматска капа (D-7). */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const TEST_MONTH = '2026-11';

let auth = '';
let clientId = '';

beforeAll(async () => {
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'aleks@godigital.mk', password: DEV_PASSWORD });
  auth = `Bearer ${login.body.data.accessToken}`;

  const clients = await request(app).get('/api/clients').set('Authorization', auth);
  clientId = (clients.body.data as Array<{ id: string; name: string }>).find(
    (c) => c.name === 'Ресторан ИВ',
  )!.id;

  // Чисти го тест-месецот за идемпотентност.
  await db.task.deleteMany({ where: { group: { monthKey: TEST_MONTH } } });
  await db.publishingSlot.deleteMany({ where: { monthKey: TEST_MONTH } });
  await db.taskGroup.deleteMany({ where: { monthKey: TEST_MONTH } });
});

describe('A2 слот тек', () => {
  it('generate создава предлог-слотови', async () => {
    const r = await request(app)
      .post(`/api/clients/${clientId}/slots/generate`)
      .set('Authorization', auth)
      .send({ month: TEST_MONTH });
    expect(r.status).toBe(201);
    const slots = r.body.data as Array<{ status: string }>;
    expect(slots.length).toBeGreaterThan(0);
    expect(slots.every((s) => s.status === 'predlog')).toBe(true);
  });

  it('confirm ги резервира слотовите + создава мртви таскови и автоматска капа', async () => {
    const r = await request(app)
      .post(`/api/clients/${clientId}/slots/confirm`)
      .set('Authorization', auth)
      .send({ month: TEST_MONTH });
    expect(r.status).toBe(200);
    expect(r.body.data.reserved).toBeGreaterThan(0);
    expect(r.body.data.groups).toBeGreaterThanOrEqual(1);

    // слотовите се reserved
    const slots = await db.publishingSlot.findMany({
      where: { clientId, monthKey: TEST_MONTH },
    });
    expect(slots.every((s) => s.status === 'reserved')).toBe(true);

    // мртви таскови врзани за слот
    const tasks = await db.task.findMany({ where: { group: { monthKey: TEST_MONTH }, clientId } });
    expect(tasks.length).toBe(slots.length);
    expect(tasks.every((t) => t.status === 'mrtov' && t.slotId)).toBe(true);

    // автоматска капа (D-7): видео=podgotovka, графика=gPodgotovka
    const groups = await db.taskGroup.findMany({ where: { clientId, monthKey: TEST_MONTH } });
    expect(groups.length).toBeGreaterThanOrEqual(1);
    expect(
      groups.every((g) =>
        g.contentType === 'video' ? g.status === 'podgotovka' : g.status === 'gPodgotovka',
      ),
    ).toBe(true);
  });

  it('generate е идемпотентен (повторно не дуплира)', async () => {
    const before = await db.publishingSlot.count({ where: { clientId, monthKey: TEST_MONTH } });
    await request(app)
      .post(`/api/clients/${clientId}/slots/generate`)
      .set('Authorization', auth)
      .send({ month: TEST_MONTH });
    const after = await db.publishingSlot.count({ where: { clientId, monthKey: TEST_MONTH } });
    expect(after).toBe(before);
  });
});
