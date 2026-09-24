import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { env } from '../env.js';
import { cleanupMonth } from './helpers.js';

/** Интеграциски тест за B3.1: сторидж cleanup + продолжување + локална архива. */
const app = createApp();
const db = new PrismaClient();
const MONTHS = ['2027-07', '2027-08', '2027-09', '2027-10'] as const;
let dirToken = '';
let monToken = '';
let clientId = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: 'gd-devpass-2026' });
  return r.body.data.accessToken as string;
}
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

async function makeGroupWithRaw(
  monthKey: string,
  rawDeleteAt: Date | null,
): Promise<{ groupId: string; assetId: string }> {
  const group = await db.taskGroup.create({
    data: { clientId, contentType: 'video', monthKey, status: 'zatvoren', rawDeleteAt },
  });
  const asset = await db.fileAsset.create({
    data: {
      ownerType: 'group',
      ownerId: group.id,
      kind: 'raw',
      r2Key: `test/raw/${group.id}.mp4`,
      size: BigInt(1024),
      mime: 'video/mp4',
      lifecycle: 'active',
    },
  });
  return { groupId: group.id, assetId: asset.id };
}

beforeAll(async () => {
  dirToken = await login('aleks@godigital.mk');
  monToken = await login('dejan@godigital.mk');
  for (const m of MONTHS) await cleanupMonth(db, m);
  await db.fileAsset.deleteMany({ where: { r2Key: { startsWith: 'test/big/' } } });
  clientId = (await db.client.findFirst({ where: { status: 'aktiven', archivedAt: null } }))!.id;
});

describe('B3.1 storage lifecycle', () => {
  it('cleanup брише истечен суров материјал (lifecycle→deleted, тајмер исчистен)', async () => {
    const past = new Date();
    past.setUTCDate(past.getUTCDate() - 1);
    const { groupId, assetId } = await makeGroupWithRaw(MONTHS[0], past);

    const r = await request(app)
      .post('/api/cron/storage-cleanup')
      .set('x-cron-secret', env.CRON_SECRET)
      .send({});
    expect(r.status).toBe(200);
    expect(r.body.data.assetsDeleted).toBeGreaterThan(0);

    const asset = await db.fileAsset.findUnique({ where: { id: assetId } });
    expect(asset!.lifecycle).toBe('deleted');
    const group = await db.taskGroup.findUnique({ where: { id: groupId } });
    expect(group!.rawDeleteAt).toBeNull();
  });

  it('продолжување поместува rawDeleteAt за ~30 дена', async () => {
    const soon = new Date();
    soon.setUTCDate(soon.getUTCDate() + 2);
    const { groupId } = await makeGroupWithRaw(MONTHS[1], soon);

    const r = await request(app)
      .post(`/api/task-groups/${groupId}/storage/extend`)
      .set(bearer(dirToken));
    expect(r.status).toBe(200);
    const after = new Date(r.body.data.rawDeleteAt).getTime();
    expect(after).toBeGreaterThan(soon.getTime() + 25 * 86_400_000);
  });

  it('локална архива спречува бришење (archivedLocally + патека)', async () => {
    const past = new Date();
    past.setUTCDate(past.getUTCDate() - 1);
    const { groupId, assetId } = await makeGroupWithRaw(MONTHS[2], past);

    const arch = await request(app)
      .post(`/api/task-groups/${groupId}/storage/archive`)
      .set(bearer(dirToken))
      .send({ path: 'D:/Arhiva/klient/2027-07' });
    expect(arch.status).toBe(200);
    expect(arch.body.data.localArchivePath).toBe('D:/Arhiva/klient/2027-07');

    // Cleanup не смее да го избрише архивираниот материјал.
    await request(app)
      .post('/api/cron/storage-cleanup')
      .set('x-cron-secret', env.CRON_SECRET)
      .send({});
    const asset = await db.fileAsset.findUnique({ where: { id: assetId } });
    expect(asset!.lifecycle).toBe('archivedLocally');
  });

  it('улога без дозвола (mon) → 403', async () => {
    const { groupId } = await makeGroupWithRaw(MONTHS[3], null);
    const r = await request(app)
      .post(`/api/task-groups/${groupId}/storage/extend`)
      .set(bearer(monToken));
    expect(r.status).toBe(403);
  });

  it('квота аларм се создава кога вкупниот сторидж го надминува прагот', async () => {
    await db.notification.deleteMany({ where: { eventKey: 'storage_quota' } });
    const big = await db.fileAsset.create({
      data: {
        ownerType: 'task',
        ownerId: randomUUID(),
        kind: 'raw',
        r2Key: `test/big/${randomUUID()}.mp4`,
        size: BigInt(600) * BigInt(1024) ** BigInt(3), // 600 GB > default праг 500 GB
        mime: 'video/mp4',
        lifecycle: 'active',
      },
    });
    try {
      const r = await request(app)
        .post('/api/cron/storage-quota')
        .set('x-cron-secret', env.CRON_SECRET)
        .send({});
      expect(r.status).toBe(200);
      expect(r.body.data.created).toBeGreaterThan(0);
      const dir = await db.employee.findFirst({ where: { role: 'dir', active: true } });
      const notif = await db.notification.findFirst({
        where: { recipientId: dir!.id, eventKey: 'storage_quota' },
      });
      expect(notif!.level).toBe('kritichen');
    } finally {
      await db.fileAsset.delete({ where: { id: big.id } });
    }
  });
});
