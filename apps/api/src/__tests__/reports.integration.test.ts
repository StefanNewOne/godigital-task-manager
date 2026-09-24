import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { env } from '../env.js';
import { cleanupMonth } from './helpers.js';

/** Интеграциски тест за B2.5: месечен извештај по клиент + CSV. */
const app = createApp();
const db = new PrismaClient();
const MONTH = '2027-06';
let anaToken = '';
let noAccessToken = '';
let clientName = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: 'gd-devpass-2026' });
  return r.body.data.accessToken as string;
}
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  anaToken = await login('vane@godigital.mk');
  noAccessToken = await login('dejan@godigital.mk'); // монтажер — нема пристап до извештаи
  await cleanupMonth(db, MONTH);
  const client = await db.client.findFirst({ where: { status: 'aktiven', archivedAt: null } });
  clientName = client!.name;
  const group = await db.taskGroup.create({
    data: { clientId: client!.id, contentType: 'graphic', monthKey: MONTH, status: 'zatvoren' },
  });
  const task = await db.task.create({
    data: {
      groupId: group.id,
      clientId: client!.id,
      contentType: 'graphic',
      title: 'report тест',
      status: 'objaveno',
    },
  });
  await db.publication.create({
    data: {
      taskId: task.id,
      platform: 'ig',
      postType: 'post',
      permalink: 'https://instagram.com/p/ReportTest1',
      externalRef: 'ReportTest1',
      resolveStatus: 'pending',
    },
  });
  await request(app).post('/api/cron/metrics-pull').set('x-cron-secret', env.CRON_SECRET).send({});
});

describe('B2.5 reports', () => {
  it('JSON извештај содржи ред за клиентот со објави и метрики', async () => {
    const r = await request(app).get(`/api/reports/clients?month=${MONTH}`).set(bearer(anaToken));
    expect(r.status).toBe(200);
    expect(r.body.data.month).toBe(MONTH);
    const rows = r.body.data.rows as Array<{ name: string; graphicPosts: number; reach: number }>;
    const row = rows.find((x) => x.name === clientName);
    expect(row).toBeTruthy();
    expect(row!.graphicPosts).toBeGreaterThan(0);
    expect(row!.reach).toBeGreaterThan(0);
  });

  it('CSV извештај има точен Content-Type и заглавие', async () => {
    const r = await request(app)
      .get(`/api/reports/clients.csv?month=${MONTH}`)
      .set(bearer(anaToken));
    expect(r.status).toBe(200);
    expect(r.headers['content-type']).toContain('text/csv');
    expect(r.headers['content-disposition']).toContain(`izvestaj-${MONTH}.csv`);
    expect(r.text).toContain('Клиент');
    expect(r.text).toContain('Досег');
  });

  it('улога без пристап (монтажер) → 403', async () => {
    const r = await request(app)
      .get(`/api/reports/clients?month=${MONTH}`)
      .set(bearer(noAccessToken));
    expect(r.status).toBe(403);
  });
});
