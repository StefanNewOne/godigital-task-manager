import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { env } from '../env.js';
import { cleanupMonth } from './helpers.js';

/** Интеграциски тест за B1: дневен преглед за Директор (notifications.digest). */
const app = createApp();
const db = new PrismaClient();
let dirId = '';

beforeAll(async () => {
  dirId = (await db.employee.findUnique({ where: { email: 'aleks@godigital.mk' } }))!.id;
  await db.notification.deleteMany({ where: { recipientId: dirId, eventKey: 'daily_digest' } });
  await cleanupMonth(db, '2027-02');

  // Гарантирај барем една задача „кај клиент" за да прегледот секогаш има што да пријави.
  const client = await db.client.findFirst({ where: { status: 'aktiven', archivedAt: null } });
  const group = await db.taskGroup.create({
    data: { clientId: client!.id, contentType: 'graphic', monthKey: '2027-02', status: 'zatvoren' },
  });
  await db.task.create({
    data: {
      groupId: group.id,
      clientId: client!.id,
      contentType: 'graphic',
      title: 'digest тест — кај клиент',
      status: 'kajKlient',
    },
  });
});

describe('B1 дневен преглед', () => {
  it('cron notifications-digest создава alarm преглед за Директор (in-app + email)', async () => {
    const r = await request(app)
      .post('/api/cron/notifications-digest')
      .set('x-cron-secret', env.CRON_SECRET)
      .send({});
    expect(r.status).toBe(200);
    expect(r.body.data.created).toBeGreaterThan(0);

    const digest = await db.notification.findFirst({
      where: { recipientId: dirId, eventKey: 'daily_digest' },
    });
    expect(digest).toBeTruthy();
    expect(digest!.level).toBe('alarm');
    expect(digest!.channelsSent).toContain('email');
    expect(digest!.body).toContain('Кај клиент за одобрување');
  });

  it('дедупликација: втор повик истиот ден не создава дупликат', async () => {
    const before = await db.notification.count({
      where: { recipientId: dirId, eventKey: 'daily_digest' },
    });
    const r = await request(app)
      .post('/api/cron/notifications-digest')
      .set('x-cron-secret', env.CRON_SECRET)
      .send({});
    expect(r.status).toBe(200);
    const after = await db.notification.count({
      where: { recipientId: dirId, eventKey: 'daily_digest' },
    });
    expect(after).toBe(before);
  });

  it('без cron токен → 403', async () => {
    const r = await request(app).post('/api/cron/notifications-digest').send({});
    expect(r.status).toBe(403);
  });
});
