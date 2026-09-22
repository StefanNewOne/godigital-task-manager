import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { cleanupMonth } from './helpers.js';

/** Интеграциски тест за A6 (објава/externalRef) + A7 (Преглед покриеност). */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const MONTH = '2027-07';

let clientId = '';
let taskId = '';
let dirToken = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}

beforeAll(async () => {
  dirToken = await login('aleks@godigital.mk');
  clientId = (await db.client.findFirst({ where: { name: 'Ресторан ИВ' } }))!.id;
  await cleanupMonth(db, MONTH);
  const g = await db.taskGroup.create({
    data: {
      clientId,
      contentType: 'graphic',
      monthKey: MONTH,
      status: 'zatvoren',
      plannedCount: 1,
    },
  });
  taskId = (
    await db.task.create({
      data: {
        groupId: g.id,
        clientId,
        contentType: 'graphic',
        title: 'За објава',
        status: 'zaObjavuvanje',
        copy: 'Копи',
      },
    })
  ).id;
});

const auth = () => ({ Authorization: `Bearer ${dirToken}` });

describe('A6 објава + A7 преглед', () => {
  it('POST /publications извлекува externalRef (Instagram shortcode)', async () => {
    const r = await request(app)
      .post(`/api/tasks/${taskId}/publications`)
      .set(auth())
      .send({ platform: 'ig', postType: 'reel', permalink: 'https://instagram.com/reel/AbC123_x' });
    expect(r.status).toBe(201);
    expect(r.body.data.externalRef).toBe('AbC123_x');
    expect(r.body.data.resolveStatus).toBe('pending');
  });

  it('втора објава на иста платформа → upsert (200)', async () => {
    const r = await request(app)
      .post(`/api/tasks/${taskId}/publications`)
      .set(auth())
      .send({ platform: 'ig', postType: 'post', permalink: 'https://instagram.com/p/NewCode9' });
    expect(r.status).toBe(200);
    expect(r.body.data.externalRef).toBe('NewCode9');
  });

  it('GET /overview враќа покриеност по клиент + работа по статус', async () => {
    const r = await request(app).get('/api/overview').set(auth());
    expect(r.status).toBe(200);
    expect(Array.isArray(r.body.data.coverage)).toBe(true);
    expect(r.body.data.coverage.length).toBeGreaterThanOrEqual(6);
    expect(Array.isArray(r.body.data.byStatus)).toBe(true);
    // сортирано најкритично прво (растечки денови)
    const days = r.body.data.coverage.map((c: { days: number }) => c.days);
    expect([...days].sort((a, b) => a - b)).toEqual(days);
  });
});
