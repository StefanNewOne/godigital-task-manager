import request from 'supertest';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';

/** Интеграциски тест за H3 Фаза 3: CRUD над AutomationRule (Директор). Бара жив Postgres + seed. */
const app = createApp();
const db = new PrismaClient();
let dirToken = '';
let monToken = '';
const createdIds: string[] = [];

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: 'gd-devpass-2026' });
  return r.body.data.accessToken as string;
}
const asDir = () => ({ Authorization: `Bearer ${dirToken}` });

const validRule = {
  name: 'Тест правило (e2e)',
  scope: 'global',
  spec: { type: 'coverage_below', days: 10 },
  action: { level: 'alarm', recipients: 'directors' },
};

beforeAll(async () => {
  dirToken = await login('aleks@godigital.mk');
  monToken = await login('dejan@godigital.mk'); // Монтажер (не-Директор, нема admin екран)
});

afterAll(async () => {
  // Чисти ги создадените тест-правила (hard delete е ок за тест-артефакти).
  if (createdIds.length) await db.automationRule.deleteMany({ where: { id: { in: createdIds } } });
  await db.$disconnect();
});

describe('AutomationRule CRUD (H3 Фаза 3)', () => {
  it('не-Директор без admin екран → 403', async () => {
    const r = await request(app)
      .post('/api/automation-rules')
      .set({ Authorization: `Bearer ${monToken}` })
      .send(validRule);
    expect(r.status).toBe(403);
  });

  it('невалиден спец → 400', async () => {
    const r = await request(app)
      .post('/api/automation-rules')
      .set(asDir())
      .send({ ...validRule, spec: { type: 'coverage_below', days: 0 } });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('VALIDATION_FAILED');
  });

  it('Директор создава правило → 201, типизирано персистирано', async () => {
    const r = await request(app).post('/api/automation-rules').set(asDir()).send(validRule);
    expect(r.status).toBe(201);
    expect(r.body.data.trigger.type).toBe('coverage_below');
    expect(r.body.data.conditions.days).toBe(10);
    expect(r.body.data.actions.level).toBe('alarm');
    expect(r.body.data.isSystem).toBe(false);
    createdIds.push(r.body.data.id);
  });

  it('PATCH менува прагови/акција', async () => {
    const r = await request(app)
      .patch(`/api/automation-rules/${createdIds[0]}`)
      .set(asDir())
      .send({
        ...validRule,
        spec: { type: 'coverage_below', days: 5 },
        action: { level: 'kritichen', recipients: 'directors' },
      });
    expect(r.status).toBe(200);
    expect(r.body.data.conditions.days).toBe(5);
    expect(r.body.data.actions.level).toBe('kritichen');
  });

  it('GET не ги враќа архивираните по DELETE (soft-delete)', async () => {
    const del = await request(app).delete(`/api/automation-rules/${createdIds[0]}`).set(asDir());
    expect(del.status).toBe(200);
    const list = await request(app).get('/api/automation-rules').set(asDir());
    expect(
      (list.body.data as Array<{ id: string }>).find((x) => x.id === createdIds[0]),
    ).toBeUndefined();
  });

  it('системско правило: типот не може да се менува (400)', async () => {
    const list = await request(app).get('/api/automation-rules').set(asDir());
    const sys = (list.body.data as Array<{ id: string; isSystem: boolean; name: string }>).find(
      (x) => x.isSystem && x.name.includes('покриеност'),
    );
    expect(sys).toBeTruthy();
    const r = await request(app)
      .patch(`/api/automation-rules/${sys!.id}`)
      .set(asDir())
      .send({ ...validRule, spec: { type: 'storage_quota', pct: 80 } });
    expect(r.status).toBe(400);
  });

  it('системско правило не може да се избрише (400)', async () => {
    const list = await request(app).get('/api/automation-rules').set(asDir());
    const sys = (list.body.data as Array<{ id: string; isSystem: boolean }>).find(
      (x) => x.isSystem,
    );
    const r = await request(app).delete(`/api/automation-rules/${sys!.id}`).set(asDir());
    expect(r.status).toBe(400);
  });
});
