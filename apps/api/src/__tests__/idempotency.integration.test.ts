import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';

/** Интеграциски тест: Idempotency-Key спречува дупликат при офлајн replay (C3). */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const KEY = 'gd-idem-test-key-c3';
const BODY = 'Идемпотентен коментар C3';

let token = '';
let taskId = '';

beforeAll(async () => {
  const r = await request(app)
    .post('/api/auth/login')
    .send({ email: 'aleks@godigital.mk', password: DEV_PASSWORD });
  token = r.body.data.accessToken;
  taskId = (await db.task.findFirst({ select: { id: true } }))!.id;
  await db.idempotencyKey.deleteMany({ where: { key: KEY } });
  await db.comment.deleteMany({ where: { taskId, body: BODY } });
});

afterAll(async () => {
  await db.idempotencyKey.deleteMany({ where: { key: KEY } });
  await db.comment.deleteMany({ where: { taskId, body: BODY } });
});

describe('Идемпотентност (C3)', () => {
  it('ист Idempotency-Key → една акција, ист одговор', async () => {
    const send = () =>
      request(app)
        .post(`/api/tasks/${taskId}/comments`)
        .set({ Authorization: `Bearer ${token}`, 'Idempotency-Key': KEY })
        .send({ body: BODY });

    const first = await send();
    const second = await send();
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);

    // Само еден коментар е создаден и вториот одговор е ист (кеширан).
    const count = await db.comment.count({ where: { taskId, body: BODY } });
    expect(count).toBe(1);
    expect(second.body).toEqual(first.body);
  });

  it('без Idempotency-Key → нормална (не-идемпотентна) акција', async () => {
    const r = await request(app)
      .post(`/api/tasks/${taskId}/comments`)
      .set({ Authorization: `Bearer ${token}` })
      .send({ body: 'C3 без клуч' });
    expect(r.status).toBe(201);
    await db.comment.deleteMany({ where: { taskId, body: 'C3 без клуч' } });
  });
});
