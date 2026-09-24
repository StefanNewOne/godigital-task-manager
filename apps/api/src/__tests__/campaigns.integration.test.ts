import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';

/** Интеграциски тест за B2.4: Campaign CRUD (Аналитичар). */
const app = createApp();
const db = new PrismaClient();
const NAME = 'B2.4 тест кампања';
let anaToken = '';
let monToken = '';
let clientId = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: 'gd-devpass-2026' });
  return r.body.data.accessToken as string;
}
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  anaToken = await login('vane@godigital.mk');
  monToken = await login('dejan@godigital.mk');
  await db.campaign.deleteMany({ where: { name: NAME } });
  clientId = (await db.client.findFirst({ where: { status: 'aktiven', archivedAt: null } }))!.id;
});

describe('B2.4 campaigns', () => {
  let campaignId = '';

  it('Аналитичар креира кампања', async () => {
    const r = await request(app).post('/api/campaigns').set(bearer(anaToken)).send({
      clientId,
      name: NAME,
      objective: 'reach',
      budget: 450,
      periodFrom: '2027-05-01',
      periodTo: '2027-05-31',
    });
    expect(r.status).toBe(201);
    expect(r.body.data.name).toBe(NAME);
    expect(r.body.data.status).toBe('planned');
    expect(Number(r.body.data.budget)).toBe(450);
    campaignId = r.body.data.id;
  });

  it('листата по клиент ја содржи кампањата', async () => {
    const r = await request(app).get(`/api/campaigns?clientId=${clientId}`).set(bearer(anaToken));
    expect(r.status).toBe(200);
    expect((r.body.data as Array<{ id: string }>).some((c) => c.id === campaignId)).toBe(true);
  });

  it('Аналитичар ажурира статус во active', async () => {
    const r = await request(app)
      .patch(`/api/campaigns/${campaignId}`)
      .set(bearer(anaToken))
      .send({ status: 'active' });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('active');
  });

  it('улога без дозвола (mon) → 403', async () => {
    const r = await request(app).post('/api/campaigns').set(bearer(monToken)).send({
      clientId,
      name: NAME,
      objective: 'reach',
      budget: 100,
      periodFrom: '2027-05-01',
      periodTo: '2027-05-31',
    });
    expect(r.status).toBe(403);
  });
});
