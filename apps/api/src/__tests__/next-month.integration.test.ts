import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { generateNextMonthForActiveClients } from '../services/slots.js';
import { remindMonthlyPlan } from '../services/monthlyPlan.js';
import { cleanupMonth } from './helpers.js';

/**
 * Парче 3 (редизайн): АМ генерира нареден месец (без одобрување од Директор); деактивиран
 * клиент се прескокнува. Аларм на 15-ти оди до АМ (ескалира по 15-ти).
 */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';

// Далечен „сега" за изолиран месец (нема судир со други тестови).
const NOW = new Date(Date.UTC(2031, 4, 10)); // 10.05.2031 → нареден месец 2031-06
const MONTH = '2031-06';

let rezToken = '';
let deactivatedClientId = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}

beforeAll(async () => {
  rezToken = await login('stefan@godigital.mk');
  await cleanupMonth(db, MONTH);
  await db.monthlyPlan.deleteMany({ where: { monthKey: MONTH } });

  // Деактивиран клиент — cutoff во минато (март 2031) → исклучен од 2031-06.
  const c = await db.client.findFirst({ where: { archivedAt: null, status: 'aktiven' } });
  deactivatedClientId = c!.id;
  await db.client.update({
    where: { id: deactivatedClientId },
    data: { deactivatedAt: new Date(Date.UTC(2031, 2, 20)) },
  });
});

afterAll(async () => {
  await db.client.update({ where: { id: deactivatedClientId }, data: { deactivatedAt: null } });
  await cleanupMonth(db, MONTH);
  await db.monthlyPlan.deleteMany({ where: { monthKey: MONTH } });
  await db.$disconnect();
});

describe('АМ генерира нареден месец (Парче 3)', () => {
  it('Режисер не може да генерира нареден месец (403)', async () => {
    const r = await request(app)
      .post('/api/slots/generate-next-month')
      .set({ Authorization: `Bearer ${rezToken}` });
    expect(r.status).toBe(403);
  });

  it('АМ генерира → месецот е потврден, деактивиран клиент исклучен', async () => {
    const dir = await db.employee.findFirst({ where: { role: 'am' } });
    const result = await generateNextMonthForActiveClients({ id: dir!.id, role: 'am' }, NOW);
    expect(result.month).toBe(MONTH);
    expect(result.clients).toBeGreaterThan(0);
    expect(result.results.some((r) => r.clientId === deactivatedClientId)).toBe(false);

    const plan = await db.monthlyPlan.findFirst({ where: { monthKey: MONTH } });
    expect(plan?.confirmedAt).not.toBeNull();
  });
});

describe('Аларм на 15-ти до АМ (Парче 3)', () => {
  it('пред 15-ти → тивко', async () => {
    const r = await remindMonthlyPlan(new Date(Date.UTC(2031, 6, 10)));
    expect(r.tooEarly).toBe(true);
    expect(r.notified).toBe(0);
  });

  it('на 15-ти → potsetnik до АМ', async () => {
    // целниот месец (2031-08) не смее да е потврден
    await db.monthlyPlan.deleteMany({ where: { monthKey: '2031-08' } });
    const r = await remindMonthlyPlan(new Date(Date.UTC(2031, 6, 15)));
    expect(r.level).toBe('potsetnik');
    expect(r.notified).toBeGreaterThan(0);

    const am = await db.employee.findFirst({ where: { role: 'am' } });
    const note = await db.notification.findFirst({
      where: { recipientId: am!.id, eventKey: 'monthly_next_generate' },
      orderBy: { createdAt: 'desc' },
    });
    expect(note).not.toBeNull();
  });

  it('по 15-ти → kritichen', async () => {
    await db.monthlyPlan.deleteMany({ where: { monthKey: '2031-08' } });
    const r = await remindMonthlyPlan(new Date(Date.UTC(2031, 6, 20)));
    expect(r.level).toBe('kritichen');
  });
});
