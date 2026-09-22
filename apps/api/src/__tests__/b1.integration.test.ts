import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { env } from '../env.js';

/** Интеграциски тест за B1: аларми (покриеност), известувања со дедуп, rule toggle. */
const app = createApp();
const db = new PrismaClient();
let dirToken = '';
let dirId = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: 'gd-devpass-2026' });
  return r.body.data.accessToken as string;
}
const auth = () => ({ Authorization: `Bearer ${dirToken}` });

beforeAll(async () => {
  dirToken = await login('aleks@godigital.mk');
  dirId = (await db.employee.findUnique({ where: { email: 'aleks@godigital.mk' } }))!.id;
  await db.notification.deleteMany({ where: { recipientId: dirId, eventKey: 'coverage_low' } });
});

describe('B1 аларми + известувања', () => {
  it('cron evaluate-alarms создава критични известувања за Директор', async () => {
    const r = await request(app)
      .post('/api/cron/evaluate-alarms')
      .set('x-cron-secret', env.CRON_SECRET)
      .send({});
    expect(r.status).toBe(200);
    expect(r.body.data.created).toBeGreaterThan(0);

    const list = await request(app).get('/api/notifications?unread=1').set(auth());
    expect(list.status).toBe(200);
    expect(list.body.data.length).toBeGreaterThan(0);
    expect(list.body.data[0].level).toBe('kritichen');
    expect(list.body.data[0].eventKey).toBe('coverage_low');
    expect(list.body.data[0].channelsSent).toContain('sms'); // D-12
  });

  it('дедупликација: повторна евалуација истиот ден не создава дупликати', async () => {
    const before = await db.notification.count({
      where: { recipientId: dirId, eventKey: 'coverage_low' },
    });
    await request(app)
      .post('/api/cron/evaluate-alarms')
      .set('x-cron-secret', env.CRON_SECRET)
      .send({});
    const after = await db.notification.count({
      where: { recipientId: dirId, eventKey: 'coverage_low' },
    });
    expect(after).toBe(before);
  });

  it('означи како прочитано → исчезнува од unread', async () => {
    const list = await request(app).get('/api/notifications?unread=1').set(auth());
    const id = list.body.data[0].id;
    const read = await request(app).post(`/api/notifications/${id}/read`).set(auth());
    expect(read.status).toBe(200);
    expect(read.body.data.readAt).toBeTruthy();
    const after = await request(app).get('/api/notifications?unread=1').set(auth());
    expect(after.body.data.find((n: { id: string }) => n.id === id)).toBeUndefined();
  });

  it('toggle на системско правило го менува enabled', async () => {
    const rules = await request(app).get('/api/automation-rules').set(auth());
    expect(rules.body.data.length).toBeGreaterThanOrEqual(15);
    const rule = rules.body.data[0];
    const t = await request(app).post(`/api/automation-rules/${rule.id}/toggle`).set(auth());
    expect(t.status).toBe(200);
    expect(t.body.data.enabled).toBe(!rule.enabled);
  });

  it('вработен може да ги исклучи потсетниците', async () => {
    const r = await request(app)
      .patch('/api/me/notification-prefs')
      .set(auth())
      .send({ reminders: false });
    expect(r.status).toBe(200);
    expect(r.body.data.reminders).toBe(false);
  });
});
