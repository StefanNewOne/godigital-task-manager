import { createHash } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient, type ContentType, type TaskStatus } from '@gd/db';
import { createApp } from '../app.js';

/**
 * Интеграциски тестови за клиентски PWA одобрувања (Фаза D2). Бараат жив Postgres + seed.
 * Креираат изолиран client-contact (approver) + таскови на kajKlient, па чистат на крај.
 */
const app = createApp();
const db = new PrismaClient();
const MONTH = '2029-07';
const APPROVER_EMAIL = 'd2-approver@test.mk';

const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');

let clientId = '';
let otherClientId = '';
let otherGroupId = '';
let contactId = '';
let groupId = '';
let rezId = '';
let kreaId = '';

async function mkMagicToken(token: string, expiresAt: Date): Promise<void> {
  await db.clientMagicToken.create({
    data: {
      tenantId: 'godigital',
      clientContactId: contactId,
      tokenHash: sha256(token),
      expiresAt,
    },
  });
}

async function mkTask(
  cid: string,
  gid: string,
  contentType: ContentType,
  status: TaskStatus,
  over: Record<string, unknown> = {},
): Promise<string> {
  const t = await db.task.create({
    data: { groupId: gid, clientId: cid, contentType, title: `D2 ${contentType}`, status, ...over },
  });
  return t.id;
}

/** Издава клиентска сесија преку consume (happy path) и го враќа accessToken-от. */
async function clientSession(): Promise<string> {
  const token = `sess-${Date.now()}-${Math.round(performance.now())}`;
  await mkMagicToken(token, new Date(Date.now() + 3_600_000));
  const r = await request(app).post('/api/client/auth/consume').send({ token });
  return r.body.data.accessToken as string;
}

const cbearer = (t: string) => ({ Authorization: `Bearer ${t}` });

async function cleanup(): Promise<void> {
  const groups = [groupId, otherGroupId].filter(Boolean);
  if (groups.length) {
    const tasks = await db.task.findMany({
      where: { groupId: { in: groups } },
      select: { id: true },
    });
    const tids = tasks.map((t) => t.id);
    if (tids.length) {
      await db.revision.deleteMany({ where: { taskId: { in: tids } } });
      await db.approval.deleteMany({ where: { objectType: 'task', objectId: { in: tids } } });
      await db.task.deleteMany({ where: { id: { in: tids } } });
    }
    await db.taskGroup.deleteMany({ where: { id: { in: groups } } });
  }
  if (contactId) {
    await db.clientMagicToken.deleteMany({ where: { clientContactId: contactId } });
    await db.clientContact.deleteMany({ where: { id: contactId } });
  }
}

beforeAll(async () => {
  const clients = await db.client.findMany({ take: 2, orderBy: { createdAt: 'asc' } });
  clientId = clients[0]!.id;
  otherClientId = clients[1]!.id;

  rezId = (await db.employee.findFirst({ where: { role: 'rez' } }))!.id;
  kreaId = (await db.employee.findFirst({ where: { role: 'krea' } }))!.id;

  await cleanup();

  contactId = (
    await db.clientContact.create({
      data: { clientId, name: 'D2 Одобрувач', email: APPROVER_EMAIL, isApprover: true },
    })
  ).id;

  groupId = (
    await db.taskGroup.create({
      data: {
        clientId,
        contentType: 'video',
        monthKey: MONTH,
        status: 'zatvoren',
        plannedCount: 4,
      },
    })
  ).id;
  otherGroupId = (
    await db.taskGroup.create({
      data: {
        clientId: otherClientId,
        contentType: 'video',
        monthKey: MONTH,
        status: 'zatvoren',
        plannedCount: 4,
      },
    })
  ).id;
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe('D2 magic-link auth', () => {
  it('барање за непостоечки email → 200 без нов токен (без enumeration)', async () => {
    const before = await db.clientMagicToken.count();
    const r = await request(app)
      .post('/api/client/auth/magic-link')
      .send({ email: 'nema@nikde.mk' });
    expect(r.status).toBe(200);
    expect(await db.clientMagicToken.count()).toBe(before);
  });

  it('барање за approver email → 200 + создаден токен', async () => {
    const r = await request(app)
      .post('/api/client/auth/magic-link')
      .send({ email: APPROVER_EMAIL });
    expect(r.status).toBe(200);
    const tok = await db.clientMagicToken.findFirst({
      where: { clientContactId: contactId, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(tok).toBeTruthy();
  });

  it('consume со невалиден токен → 400 MAGIC_LINK_INVALID', async () => {
    const r = await request(app).post('/api/client/auth/consume').send({ token: 'nepostoi' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('MAGIC_LINK_INVALID');
  });

  it('consume со истечен токен → 400', async () => {
    const token = `expired-${Date.now()}`;
    await mkMagicToken(token, new Date(Date.now() - 1000));
    const r = await request(app).post('/api/client/auth/consume').send({ token });
    expect(r.status).toBe(400);
  });

  it('happy path: consume издава сесија, токенот е еднократен', async () => {
    const token = `valid-${Date.now()}`;
    await mkMagicToken(token, new Date(Date.now() + 3_600_000));

    const first = await request(app).post('/api/client/auth/consume').send({ token });
    expect(first.status).toBe(200);
    expect(first.body.data.accessToken).toBeTruthy();

    const reuse = await request(app).post('/api/client/auth/consume').send({ token });
    expect(reuse.status).toBe(400);
  });
});

describe('D2 realm изолација', () => {
  it('клиентски токен не може на employee рута → 401', async () => {
    const t = await clientSession();
    const r = await request(app).get('/api/me').set(cbearer(t));
    expect(r.status).toBe(401);
  });

  it('без токен → /client/approvals 401', async () => {
    const r = await request(app).get('/api/client/approvals');
    expect(r.status).toBe(401);
  });
});

describe('D2 client approvals', () => {
  it('листа враќа само kajKlient таскови за сесискиот клиент', async () => {
    const t = await clientSession();
    const mine = await mkTask(clientId, groupId, 'video', 'kajKlient', { rezId });
    const other = await mkTask(otherClientId, otherGroupId, 'video', 'kajKlient', { rezId });

    const r = await request(app).get('/api/client/approvals').set(cbearer(t));
    expect(r.status).toBe(200);
    const ids = (r.body.data as Array<{ id: string }>).map((x) => x.id);
    expect(ids).toContain(mine);
    expect(ids).not.toContain(other);
  });

  it('approve → zaObjavuvanje + Approval(source=clientPwa, enteredById=contact)', async () => {
    const t = await clientSession();
    const id = await mkTask(clientId, groupId, 'video', 'kajKlient', { rezId });

    const r = await request(app)
      .post(`/api/client/approvals/task/${id}/decide`)
      .set(cbearer(t))
      .send({ outcome: 'approve' });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('zaObjavuvanje');

    const appr = await db.approval.findFirst({
      where: { objectType: 'task', objectId: id },
      orderBy: { createdAt: 'desc' },
    });
    expect(appr?.source).toBe('clientPwa');
    expect(appr?.outcome).toBe('approved');
    expect(appr?.enteredById).toBe(contactId);
    expect(appr?.enteredByRole).toBeNull();
  });

  it('requestChanges (графика) → dizajn + Revision(client) + v+1', async () => {
    const t = await clientSession();
    const gGroup = await db.taskGroup.create({
      data: {
        clientId,
        contentType: 'graphic',
        monthKey: MONTH,
        status: 'zatvoren',
        plannedCount: 4,
      },
    });
    const id = await mkTask(clientId, gGroup.id, 'graphic', 'kajKlient', { kreaId, version: 1 });

    const r = await request(app)
      .post(`/api/client/approvals/task/${id}/decide`)
      .set(cbearer(t))
      .send({ outcome: 'requestChanges', comment: 'Смени го насловот.' });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('dizajn');
    expect(r.body.data.version).toBe(2);

    const appr = await db.approval.findFirst({
      where: { objectType: 'task', objectId: id },
      orderBy: { createdAt: 'desc' },
    });
    expect(appr?.source).toBe('clientPwa');
    expect(appr?.outcome).toBe('returned');
    const rev = await db.revision.findFirst({ where: { taskId: id } });
    expect(rev?.source).toBe('client');

    // cleanup овој ад-хок graphic group
    await db.revision.deleteMany({ where: { taskId: id } });
    await db.approval.deleteMany({ where: { objectType: 'task', objectId: id } });
    await db.task.deleteMany({ where: { id } });
    await db.taskGroup.deleteMany({ where: { id: gGroup.id } });
  });

  it('requestChanges без коментар → 400', async () => {
    const t = await clientSession();
    const id = await mkTask(clientId, groupId, 'video', 'kajKlient', { rezId });
    const r = await request(app)
      .post(`/api/client/approvals/task/${id}/decide`)
      .set(cbearer(t))
      .send({ outcome: 'requestChanges' });
    expect(r.status).toBe(400);
  });

  it('туѓ клиент (друг clientId) → 404', async () => {
    const t = await clientSession();
    const foreign = await mkTask(otherClientId, otherGroupId, 'video', 'kajKlient', { rezId });
    const r = await request(app)
      .post(`/api/client/approvals/task/${foreign}/decide`)
      .set(cbearer(t))
      .send({ outcome: 'approve' });
    expect(r.status).toBe(404);
  });

  it('непознат kind → 404', async () => {
    const t = await clientSession();
    const r = await request(app)
      .get('/api/client/approvals/lead/00000000-0000-7000-8000-000000000000')
      .set(cbearer(t));
    expect(r.status).toBe(404);
  });
});
