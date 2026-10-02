import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';

/**
 * „Поврзи ги сите клиенти" (POST /meta/connect-all, stub). dir-only. Создава MetaConnection +
 * backfill за клиенти со доделен Meta ID. Изолиран page-only тест клиент; чисти на крај.
 */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
let clientId = '';
const token: Record<string, string> = {};

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}
const bearer = (role: string) => ({ Authorization: `Bearer ${token[role]}` });

async function cleanup(): Promise<void> {
  if (!clientId) return;
  await db.pageSnapshot.deleteMany({ where: { clientId } });
  await db.metaConnection.deleteMany({ where: { clientId } });
  await db.client.deleteMany({ where: { id: clientId } });
}

beforeAll(async () => {
  token.dir = await login('aleks@godigital.mk');
  token.am = await login('tamara@godigital.mk');
  await db.client.deleteMany({ where: { name: 'META CONNECT E2E' } });
  clientId = (
    await db.client.create({
      data: {
        name: 'META CONNECT E2E',
        color: '#123456',
        contractStart: new Date(Date.UTC(2030, 0, 1)),
        contractMonths: 12,
        metaPageId: 'pg-connect-e2e',
      },
    })
  ).id;
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe('Мета „Поврзи ги сите" (POST /meta/connect-all)', () => {
  it('не-Директор (am) → 403', async () => {
    const r = await request(app).post('/api/meta/connect-all').set(bearer('am')).send({});
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('dir → 200; создава MetaConnection(page) за клиентот со доделен Page ID', async () => {
    const r = await request(app).post('/api/meta/connect-all').set(bearer('dir')).send({});
    expect(r.status).toBe(200);
    expect(typeof r.body.data.clients).toBe('number');

    const mine = (r.body.data.results as Array<{ clientId: string; connections: number }>).find(
      (x) => x.clientId === clientId,
    );
    expect(mine, 'тест клиентот е во резултатот').toBeTruthy();
    expect(mine!.connections).toBeGreaterThanOrEqual(1);

    const conn = await db.metaConnection.findFirst({ where: { clientId, kind: 'page' } });
    expect(conn?.metaId).toBe('pg-connect-e2e');
  });
});
