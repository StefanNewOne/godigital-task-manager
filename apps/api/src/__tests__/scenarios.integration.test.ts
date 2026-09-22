import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { cleanupMonth } from './helpers.js';

/** Интеграциски тест за сценарија (A4): поделба → исходи → активација на деца. */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const MONTH = '2027-03';

let clientId = '';
let groupId = '';
let childId = '';
const token: Record<string, string> = {};

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}
const bearer = (role: string) => ({ Authorization: `Bearer ${token[role]}` });

beforeAll(async () => {
  token.dir = await login('aleks@godigital.mk');
  token.mon = await login('dejan@godigital.mk');

  const client = await db.client.findFirst({ where: { name: 'Ресторан ИВ' } });
  clientId = client!.id;
  const scen = await db.employee.findFirst({ where: { role: 'scen' } });
  const rez = await db.employee.findFirst({ where: { role: 'rez' } });
  const kam = await db.employee.findFirst({ where: { role: 'kam' } });

  await cleanupMonth(db, MONTH);

  const group = await db.taskGroup.create({
    data: {
      clientId,
      contentType: 'video',
      monthKey: MONTH,
      status: 'scenarija',
      plannedCount: 4,
      scenaristId: scen?.id ?? null,
      rezId: rez?.id ?? null,
      kamId: kam?.id ?? null,
      shootDate: new Date(Date.UTC(2027, 2, 5)),
      shootLocation: 'Скопје, студио',
      scenaristNotes: 'Белешки за снимање.',
    },
  });
  groupId = group.id;

  // Сценариски документ (за G_FILE(scenarioDoc,1)).
  await db.fileAsset.create({
    data: {
      ownerType: 'group',
      ownerId: groupId,
      kind: 'scenarioDoc',
      r2Key: `groups/${groupId}/doc.pdf`,
      size: BigInt(2048),
      mime: 'application/pdf',
    },
  });

  // Едно мртво видео дете со резервиран слот (за активација).
  const slot = await db.publishingSlot.create({
    data: {
      clientId,
      contentType: 'video',
      date: new Date(Date.UTC(2027, 2, 10)),
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

describe('Сценарија (A4)', () => {
  const scenarioIds: string[] = [];

  it('празна листа → 400', async () => {
    const r = await request(app)
      .post(`/api/task-groups/${groupId}/scenarios`)
      .set(bearer('dir'))
      .send({ scenarios: [] });
    expect(r.status).toBe(400);
  });

  it('погрешна улога (mon) → 403', async () => {
    const r = await request(app)
      .post(`/api/task-groups/${groupId}/scenarios`)
      .set(bearer('mon'))
      .send({ scenarios: [{ title: 'С1' }] });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('поделба на 2 сценарија → 201, двете predlozeno', async () => {
    const r = await request(app)
      .post(`/api/task-groups/${groupId}/scenarios`)
      .set(bearer('dir'))
      .send({ scenarios: [{ title: 'Сценарио 1' }, { title: 'Сценарио 2' }] });
    expect(r.status).toBe(201);
    expect(r.body.data).toHaveLength(2);
    expect(r.body.data.every((s: { status: string }) => s.status === 'predlozeno')).toBe(true);
    scenarioIds.push(r.body.data[0].id, r.body.data[1].id);
  });

  it('scenarija→scenKajKlient поминува (документ + поделба)', async () => {
    const r = await request(app)
      .post(`/api/task-groups/${groupId}/transition`)
      .set(bearer('dir'))
      .send({ to: 'scenKajKlient' });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('scenKajKlient');
  });

  it('исходи: 1 одобрено, 1 отфрлено', async () => {
    const r = await request(app)
      .post(`/api/task-groups/${groupId}/scenario-outcomes`)
      .set(bearer('dir'))
      .send({
        items: [
          { scenarioId: scenarioIds[0], status: 'odobreno' },
          { scenarioId: scenarioIds[1], status: 'otfrleno' },
        ],
      });
    expect(r.status).toBe(200);
  });

  it('scenKajKlient→snimanje активира точно 1 дете, врзано на одобреното сценарио', async () => {
    const r = await request(app)
      .post(`/api/task-groups/${groupId}/transition`)
      .set(bearer('dir'))
      .send({ to: 'snimanje' });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('snimanje');

    const child = await db.task.findUnique({ where: { id: childId } });
    expect(child!.status).toBe('cekaSnimanje');
    expect(child!.scenarioId).toBe(scenarioIds[0]);
  });
});
