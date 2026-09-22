import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';

/** Client contacts CRUD (A1): create → list → patch (archive преку archivedAt). */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const MARKER = 'Тест Контакт CI';

let clientId = '';
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
  await db.clientContact.deleteMany({ where: { name: MARKER } });
});

describe('Client contacts (A1)', () => {
  let contactId = '';

  it('погрешна улога (mon) на create → 403', async () => {
    const r = await request(app)
      .post(`/api/clients/${clientId}/contacts`)
      .set(bearer('mon'))
      .send({ name: MARKER });
    expect(r.status).toBe(403);
  });

  it('dir создава контакт → 201', async () => {
    const r = await request(app)
      .post(`/api/clients/${clientId}/contacts`)
      .set(bearer('dir'))
      .send({ name: MARKER, roleAtClient: 'Маркетинг', email: 'kontakt@iv.mk' });
    expect(r.status).toBe(201);
    expect(r.body.data.name).toBe(MARKER);
    expect(r.body.data.isApprover).toBe(false);
    contactId = r.body.data.id;
  });

  it('листата го содржи контактот', async () => {
    const r = await request(app).get(`/api/clients/${clientId}/contacts`).set(bearer('dir'));
    expect(r.status).toBe(200);
    expect(r.body.data.some((c: { id: string }) => c.id === contactId)).toBe(true);
  });

  it('patch поставува isApprover', async () => {
    const r = await request(app)
      .patch(`/api/contacts/${contactId}`)
      .set(bearer('dir'))
      .send({ isApprover: true });
    expect(r.status).toBe(200);
    expect(r.body.data.isApprover).toBe(true);
  });

  it('архивиран контакт не се листа', async () => {
    await request(app)
      .patch(`/api/contacts/${contactId}`)
      .set(bearer('dir'))
      .send({ archived: true });
    const r = await request(app).get(`/api/clients/${clientId}/contacts`).set(bearer('dir'));
    expect(r.body.data.some((c: { id: string }) => c.id === contactId)).toBe(false);
  });
});
