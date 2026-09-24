import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { cleanupMonth } from './helpers.js';

/** Интеграциски тест за A4: капа преоди + активација на деца (D-1/D-2). */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
// Секој тест свој месец (TaskGroup е unique по клиент+тип+месец).
const MONTHS = ['2027-03', '2027-04', '2027-05', '2027-06', '2027-08', '2027-09'];

let clientId = '';
const empId: Record<string, string> = {};
const token: Record<string, string> = {};

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}
const bearer = (role: string) => ({ Authorization: `Bearer ${token[role]}` });

async function mkGroup(monthKey: string, status: string, extra: Record<string, unknown> = {}) {
  return db.taskGroup.create({
    data: {
      clientId,
      contentType: 'video',
      monthKey,
      status: status as never,
      plannedCount: 2,
      rezId: empId.rez,
      ...extra,
    },
  });
}

async function mkChild(groupId: string, monthKey: string, date: Date, status = 'mrtov') {
  const slot = await db.publishingSlot.create({
    data: { clientId, contentType: 'video', date, status: 'reserved', monthKey },
  });
  return db.task.create({
    data: {
      groupId,
      clientId,
      contentType: 'video',
      title: `дете`,
      status: status as never,
      slotId: slot.id,
    },
  });
}

beforeAll(async () => {
  for (const [role, email] of Object.entries({
    dir: 'aleks@godigital.mk',
    rez: 'stefan@godigital.mk',
    scen: 'ilija@godigital.mk',
    kam: 'nikola@godigital.mk',
    krea: 'ljubica@godigital.mk',
  })) {
    token[role] = await login(email);
    empId[role] = (await db.employee.findUnique({ where: { email } }))!.id;
  }
  clientId = (await db.client.findFirst({ where: { name: 'Астибо' } }))!.id;
  for (const m of MONTHS) await cleanupMonth(db, m);
});

describe('A4 капа преоди', () => {
  it('podgotovka→scenarija без капа полиња → 400 GUARD_FAILED', async () => {
    const g = await mkGroup(MONTHS[0]!, 'podgotovka');
    const r = await request(app)
      .post(`/api/task-groups/${g.id}/transition`)
      .set(bearer('rez'))
      .send({ to: 'scenarija' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('GUARD_FAILED');
    expect(r.body.details.missing).toContain('scenarist');
  });

  it('podgotovka→scenarija со полиња → назначен сценарист', async () => {
    const g = await mkGroup(MONTHS[1]!, 'podgotovka');
    const r = await request(app)
      .post(`/api/task-groups/${g.id}/transition`)
      .set(bearer('rez'))
      .send({
        to: 'scenarija',
        payload: {
          scenaristId: empId.scen,
          shootDate: '2027-04-10T10:00:00Z',
          shootLocation: 'Штип',
          scenaristNotes: 'Насоки за снимање.',
        },
      });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('scenarija');
    expect(r.body.data.scenaristId).toBe(empId.scen);
  });

  it('scenKajKlient→snimanje активира деца во cekaSnimanje (D-1), датумот останува (D-2)', async () => {
    const g = await mkGroup(MONTHS[2]!, 'scenKajKlient', { kamId: empId.kam });
    await db.scenario.create({
      data: { groupId: g.id, ordinal: 1, title: 'С1', status: 'odobreno' },
    });
    await db.scenario.create({
      data: { groupId: g.id, ordinal: 2, title: 'С2', status: 'odobrenoSoIzmeni' },
    });
    const c1 = await mkChild(g.id, MONTHS[2]!, new Date(Date.UTC(2027, 4, 5)));
    await mkChild(g.id, MONTHS[2]!, new Date(Date.UTC(2027, 4, 12)));
    const before = (await db.task.findUnique({ where: { id: c1.id }, include: { slot: true } }))!
      .slot!.date;

    const r = await request(app)
      .post(`/api/task-groups/${g.id}/transition`)
      .set(bearer('rez'))
      .send({ to: 'snimanje' });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('snimanje');

    const kids = await db.task.findMany({ where: { groupId: g.id } });
    expect(kids.every((k) => k.status === 'cekaSnimanje')).toBe(true);
    expect(kids.every((k) => k.scenarioId !== null)).toBe(true);
    expect(kids.every((k) => k.assigneeId === empId.kam)).toBe(true);
    const after = (await db.task.findUnique({ where: { id: c1.id }, include: { slot: true } }))!
      .slot!.date;
    expect(after.getTime()).toBe(before.getTime());
  });

  it('snimanje→zatvoren (суров материјал) → деца chekaRezija, капа затворена', async () => {
    const g = await mkGroup(MONTHS[3]!, 'snimanje', { kamId: empId.kam });
    await mkChild(g.id, MONTHS[3]!, new Date(Date.UTC(2027, 5, 20)), 'cekaSnimanje');

    const blocked = await request(app)
      .post(`/api/task-groups/${g.id}/transition`)
      .set(bearer('kam'))
      .send({ to: 'zatvoren' });
    expect(blocked.status).toBe(400);
    expect(blocked.body.details.missing).toContain('raw');

    await db.fileAsset.create({
      data: {
        ownerType: 'group',
        ownerId: g.id,
        kind: 'raw',
        r2Key: 'raw/x.mp4',
        size: 1n,
        mime: 'video/mp4',
      },
    });
    const r = await request(app)
      .post(`/api/task-groups/${g.id}/transition`)
      .set(bearer('kam'))
      .send({ to: 'zatvoren' });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('zatvoren');
    expect(r.body.data.rawDeleteAt).toBeTruthy();

    const kids = await db.task.findMany({ where: { groupId: g.id } });
    expect(kids.every((k) => k.status === 'chekaRezija' && k.assigneeId === empId.rez)).toBe(true);
  });

  it('авто-затворање (#7): качување суров материјал преку presign ја затвора капата', async () => {
    const g = await mkGroup(MONTHS[5]!, 'snimanje', { kamId: empId.kam });
    await mkChild(g.id, MONTHS[5]!, new Date(Date.UTC(2027, 8, 20)), 'cekaSnimanje');

    // Камерманот качува суров материјал — без рачен transition повик.
    const r = await request(app)
      .post('/api/files/presign')
      .set(bearer('kam'))
      .send({ ownerType: 'group', ownerId: g.id, kind: 'raw', mime: 'video/mp4', size: 2048 });
    expect(r.status).toBe(201);

    const group = await db.taskGroup.findUnique({ where: { id: g.id } });
    expect(group!.status, 'капата авто-се затвора при качување суров материјал').toBe('zatvoren');
    const kids = await db.task.findMany({ where: { groupId: g.id } });
    expect(kids.every((k) => k.status === 'chekaRezija' && k.assigneeId === empId.rez)).toBe(true);
  });

  it('графичка капа: bulk активација → сите деца во brifing, капа затворена (D-3)', async () => {
    const g = await db.taskGroup.create({
      data: {
        clientId,
        contentType: 'graphic',
        monthKey: MONTHS[4]!,
        status: 'gPodgotovka',
        plannedCount: 3,
      },
    });
    for (let i = 0; i < 3; i++) {
      const slot = await db.publishingSlot.create({
        data: {
          clientId,
          contentType: 'graphic',
          date: new Date(Date.UTC(2027, 7, 5 + i)),
          status: 'reserved',
          monthKey: MONTHS[4]!,
        },
      });
      await db.task.create({
        data: {
          groupId: g.id,
          clientId,
          contentType: 'graphic',
          title: `г${i}`,
          status: 'mrtov',
          slotId: slot.id,
        },
      });
    }
    const r = await request(app)
      .post(`/api/task-groups/${g.id}/activate-all`)
      .set(bearer('krea'))
      .send({});
    expect(r.status).toBe(200);
    expect(r.body.data.activated).toBe(3);

    const group = await db.taskGroup.findUnique({ where: { id: g.id } });
    expect(group!.status).toBe('zatvoren');
    const kids = await db.task.findMany({ where: { groupId: g.id } });
    expect(kids.every((k) => k.status === 'brifing' && k.assigneeId === empId.krea)).toBe(true);
  });
});
