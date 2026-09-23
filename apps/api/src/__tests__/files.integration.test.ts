import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';

/**
 * Интеграциски тест за A6 фајлови: presign single-PUT (потпис локално, без R2 сервер) +
 * авторизација на сопственик (И4/И7) — само Директор/доделен/носител-на-статус смее да прикачува.
 */
const app = createApp();
const db = new PrismaClient();

const login = async (email: string): Promise<string> => {
  const r = await request(app).post('/api/auth/login').send({ email, password: 'gd-devpass-2026' });
  return r.body.data.accessToken as string;
};
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });

let dirToken = '';
let dizToken = '';
let anaToken = '';
let dizajnTaskId = '';

beforeAll(async () => {
  dirToken = await login('aleks@godigital.mk'); // Директор
  dizToken = await login('dragan@godigital.mk'); // Дизајнер (носител на статус „dizajn")
  anaToken = await login('vane@godigital.mk'); // Аналитичар (не носи „dizajn")

  // Земи вистински таск во статус „dizajn" (сопственик = diz) од seed/демо податоците.
  const list = await request(app).get('/api/tasks').set(auth(dirToken));
  const task = (list.body.data as Array<{ id: string; status: string }>).find(
    (t) => t.status === 'dizajn',
  );
  dizajnTaskId = task!.id;
});

describe('A6 files presign + авторизација', () => {
  it('Директор presign-ира мал фајл за вистински таск → single PUT url + FileAsset', async () => {
    const r = await request(app).post('/api/files/presign').set(auth(dirToken)).send({
      ownerType: 'task',
      ownerId: dizajnTaskId,
      kind: 'briefRef',
      mime: 'image/png',
      size: 2048,
    });
    expect(r.status).toBe(201);
    expect(r.body.data.mode).toBe('single');
    expect(r.body.data.url).toContain('godigital');

    const fa = await db.fileAsset.findUnique({ where: { id: r.body.data.fileId } });
    expect(fa!.lifecycle).toBe('active');
  });

  it('Носителот на статусот (Дизајнер) смее да presign-ира за „dizajn" таск', async () => {
    const r = await request(app).post('/api/files/presign').set(auth(dizToken)).send({
      ownerType: 'task',
      ownerId: dizajnTaskId,
      kind: 'final',
      mime: 'image/png',
      size: 1024,
    });
    expect(r.status).toBe(201);
  });

  it('Улога што не го носи статусот (Аналитичар) → 403 FORBIDDEN_ROLE', async () => {
    const r = await request(app).post('/api/files/presign').set(auth(anaToken)).send({
      ownerType: 'task',
      ownerId: dizajnTaskId,
      kind: 'final',
      mime: 'image/png',
      size: 1024,
    });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('presign за непостоечки сопственик → 404 (без создавање FileAsset)', async () => {
    const r = await request(app).post('/api/files/presign').set(auth(dirToken)).send({
      ownerType: 'task',
      ownerId: randomUUID(),
      kind: 'briefRef',
      mime: 'image/png',
      size: 2048,
    });
    expect(r.status).toBe(404);
    expect(r.body.code).toBe('NOT_FOUND');
  });

  it('невалиден ownerType → 400', async () => {
    const r = await request(app).post('/api/files/presign').set(auth(dirToken)).send({
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
