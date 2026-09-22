import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';

/** Интеграциски тест за A6 фајлови: presign single-PUT (потпис локално, без R2 сервер). */
const app = createApp();
const db = new PrismaClient();
let dirToken = '';

beforeAll(async () => {
  const r = await request(app)
    .post('/api/auth/login')
    .send({ email: 'aleks@godigital.mk', password: 'gd-devpass-2026' });
  dirToken = r.body.data.accessToken;
});

describe('A6 files presign', () => {
  it('presign мал фајл → single PUT url + FileAsset', async () => {
    const r = await request(app)
      .post('/api/files/presign')
      .set({ Authorization: `Bearer ${dirToken}` })
      .send({
        ownerType: 'task',
        ownerId: randomUUID(),
        kind: 'briefRef',
        mime: 'image/png',
        size: 2048,
      });
    expect(r.status).toBe(201);
    expect(r.body.data.mode).toBe('single');
    expect(typeof r.body.data.url).toBe('string');
    expect(r.body.data.url).toContain('godigital'); // bucket во path

    const fa = await db.fileAsset.findUnique({ where: { id: r.body.data.fileId } });
    expect(fa).toBeTruthy();
    expect(fa!.kind).toBe('briefRef');
    expect(fa!.lifecycle).toBe('active');
  });

  it('невалиден ownerType → 400', async () => {
    const r = await request(app)
      .post('/api/files/presign')
      .set({ Authorization: `Bearer ${dirToken}` })
      .send({
        ownerType: 'nonsense',
        ownerId: randomUUID(),
        kind: 'briefRef',
        mime: 'image/png',
        size: 2048,
      });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('VALIDATION_FAILED');
  });
});
