import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';

/**
 * Парче 4 (редизайн): замрзнување + аларм. Деактивиран клиент → таскови со датум по cutoff
 * не смеат да напредуваат (TASK_FROZEN) и капа-активацијата ги остава мртви + аларм до АМ.
 */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';

// Клиентот е деактивиран на 20.03.2031 → cutoff 31.03.2031.
const DEACT = new Date(Date.UTC(2031, 2, 20));

let dirToken = '';
let clientId = '';
let baseGroupId = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}

beforeAll(async () => {
  dirToken = await login('aleks@godigital.mk');
  const client = await db.client.create({
    data: {
      name: 'ТЕСТ Замрзнување',
      color: '#7C3AED',
      contractStart: new Date(Date.UTC(2031, 0, 1)),
      contractMonths: 12,
      videosPerMonth: 4,
      graphicsPerMonth: 0,
      deactivatedAt: DEACT,
    },
  });
  clientId = client.id;
  const group = await db.taskGroup.create({
    data: {
      clientId,
      contentType: 'video',
      monthKey: '2031-03',
      status: 'snimanje',
      plannedCount: 2,
    },
  });
  baseGroupId = group.id;
});

afterAll(async () => {
  await db.task.deleteMany({ where: { clientId } });
  await db.scenario.deleteMany({ where: { group: { clientId } } });
  await db.publishingSlot.deleteMany({ where: { clientId } });
  await db.taskGroup.deleteMany({ where: { clientId } });
  await db.client.delete({ where: { id: clientId } });
  await db.$disconnect();
});

async function makeTaskWithSlot(status: string, date: Date): Promise<string> {
  const slot = await db.publishingSlot.create({
    data: {
      clientId,
      contentType: 'video',
      date,
      orderInDay: 1,
      status: 'reserved',
      monthKey: `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`,
    },
  });
  const task = await db.task.create({
    data: {
      groupId: baseGroupId,
      clientId,
      contentType: 'video',
      title: `Таск ${status} ${date.toISOString().slice(0, 10)}`,
      status: status as never,
      slotId: slot.id,
    },
  });
  return task.id;
}

describe('Замрзнување при преод (Парче 4)', () => {
  it('таск со датум по cutoff не смее да напредува (409 TASK_FROZEN) + аларм до АМ', async () => {
    const taskId = await makeTaskWithSlot('montaza', new Date(Date.UTC(2031, 5, 10)));
    const r = await request(app)
      .post(`/api/tasks/${taskId}/transition`)
      .set({ Authorization: `Bearer ${dirToken}` })
      .send({ to: 'vnatresno', payload: { reason: 'тест' } });
    expect(r.status).toBe(409);
    expect(r.body.code).toBe('TASK_FROZEN');

    const am = await db.employee.findFirst({ where: { role: 'am' } });
    const note = await db.notification.findFirst({
      where: { recipientId: am!.id, eventKey: 'frozen_work' },
    });
    expect(note).not.toBeNull();
  });

  it('таск со датум во тековниот (пред cutoff) месец не е замрзнат', async () => {
    const taskId = await makeTaskWithSlot('montaza', new Date(Date.UTC(2031, 2, 10)));
    const r = await request(app)
      .post(`/api/tasks/${taskId}/transition`)
      .set({ Authorization: `Bearer ${dirToken}` })
      .send({ to: 'vnatresno', payload: { reason: 'тест' } });
    expect(r.status).not.toBe(409);
    expect(r.body.code).not.toBe('TASK_FROZEN');
  });
});

describe('Замрзнување при капа-активација (Парче 4)', () => {
  it('деца по cutoff остануваат мртви, активни се активираат, аларм до АМ', async () => {
    const rez = await db.employee.findFirst({ where: { role: 'rez' } });
    const kam = await db.employee.findFirst({ where: { role: 'kam' } });
    const group = await db.taskGroup.create({
      data: {
        clientId,
        contentType: 'video',
        monthKey: '2031-04',
        status: 'scenKajKlient',
        plannedCount: 2,
        rezId: rez?.id ?? null,
        kamId: kam?.id ?? null,
      },
    });
    for (let i = 1; i <= 2; i++) {
      await db.scenario.create({
        data: {
          groupId: group.id,
          ordinal: i,
          docVersion: 0,
          title: `Сценарио ${i}`,
          status: 'odobreno',
          source: 'manual',
        },
      });
    }
    const activeSlot = await db.publishingSlot.create({
      data: {
        clientId,
        contentType: 'video',
        date: new Date(Date.UTC(2031, 2, 12)),
        orderInDay: 1,
        status: 'reserved',
        monthKey: '2031-03',
      },
    });
    const frozenSlot = await db.publishingSlot.create({
      data: {
        clientId,
        contentType: 'video',
        date: new Date(Date.UTC(2031, 5, 12)),
        orderInDay: 1,
        status: 'reserved',
        monthKey: '2031-06',
      },
    });
    const activeChild = await db.task.create({
      data: {
        groupId: group.id,
        clientId,
        contentType: 'video',
        title: 'Активно дете',
        status: 'mrtov',
        slotId: activeSlot.id,
      },
    });
    const frozenChild = await db.task.create({
      data: {
        groupId: group.id,
        clientId,
        contentType: 'video',
        title: 'Замрзнато дете',
        status: 'mrtov',
        slotId: frozenSlot.id,
      },
    });

    const r = await request(app)
      .post(`/api/task-groups/${group.id}/transition`)
      .set({ Authorization: `Bearer ${dirToken}` })
      .send({ to: 'snimanje', payload: { reason: 'тест' } });
    expect(r.status).toBe(200);

    const a = await db.task.findUnique({ where: { id: activeChild.id } });
    const f = await db.task.findUnique({ where: { id: frozenChild.id } });
    expect(a!.status).toBe('cekaSnimanje');
    expect(f!.status).toBe('mrtov'); // замрзнато — не активирано
  });
});
