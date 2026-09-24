import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { cleanupMonth } from './helpers.js';

/** E_CREATE_EXTRA_SLOTS (A4): вишок одобрени сценарија создаваат екстра слот + таск. */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const MONTH = '2027-04';

let clientId = '';
let groupId = '';
let childId = '';
const scenIds: string[] = [];
let token = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}

beforeAll(async () => {
  token = await login('aleks@godigital.mk');
  const client = await db.client.findFirst({ where: { name: 'Ресторан ИВ' } });
  clientId = client!.id;
  const rez = await db.employee.findFirst({ where: { role: 'rez' } });
  const kam = await db.employee.findFirst({ where: { role: 'kam' } });

  await cleanupMonth(db, MONTH);

  const group = await db.taskGroup.create({
    data: {
      clientId,
      contentType: 'video',
      monthKey: MONTH,
      status: 'scenKajKlient',
      plannedCount: 4,
      rezId: rez?.id ?? null,
      kamId: kam?.id ?? null,
    },
  });
  groupId = group.id;

  // Две одобрени сценарија, само едно резервирано дете → едно вишок.
  for (let i = 1; i <= 2; i++) {
    const s = await db.scenario.create({
      data: {
        groupId,
        ordinal: i,
        docVersion: 0,
        title: `Сценарио ${i}`,
        status: 'odobreno',
        source: 'manual',
      },
    });
    scenIds.push(s.id);
  }

  const slot = await db.publishingSlot.create({
    data: {
      clientId,
      contentType: 'video',
      date: new Date(Date.UTC(2027, 3, 6)),
      orderInDay: 1,
      status: 'reserved',
      monthKey: MONTH,
    },
  });
  const child = await db.task.create({
    data: {
      groupId,
      clientId,
      contentType: 'video',
      title: 'Видео дете',
      status: 'mrtov',
      slotId: slot.id,
    },
  });
  childId = child.id;
});

describe('E_CREATE_EXTRA_SLOTS (A4)', () => {
  it('scenKajKlient→snimanje активира 1 дете и создава 1 екстра таск+слот', async () => {
    const r = await request(app)
      .post(`/api/task-groups/${groupId}/transition`)
      .set({ Authorization: `Bearer ${token}` })
      .send({ to: 'snimanje', payload: { reason: 'Наместо режисер (D-5).' } });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('snimanje');

    const child = await db.task.findUnique({ where: { id: childId } });
    expect(child!.status).toBe('cekaSnimanje');
    expect(child!.scenarioId).toBe(scenIds[0]);

    const extras = await db.task.findMany({ where: { groupId, isExtra: true } });
    expect(extras).toHaveLength(1);
    expect(extras[0]!.status).toBe('cekaSnimanje');
    expect(extras[0]!.scenarioId).toBe(scenIds[1]);
    expect(extras[0]!.slotId).not.toBeNull();

    const extraSlot = await db.publishingSlot.findUnique({ where: { id: extras[0]!.slotId! } });
    expect(extraSlot!.status).toBe('reserved');
    expect(extraSlot!.contentType).toBe('video');
  });
});
