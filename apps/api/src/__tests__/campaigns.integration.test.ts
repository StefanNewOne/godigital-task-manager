import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';

/**
 * Кампањи — САМО ЧИТАЊЕ (Модул 3 · Мета, D1/D2 + М7). Рачно креирање/менување е отстрането;
 * огледалото го полни sync-от. Тестот потврдува дека GET работи, а POST/PATCH ги нема.
 */
const app = createApp();
const db = new PrismaClient();
const NAME = 'M7 тест кампања (само читање)';
let anaToken = '';
let clientId = '';
let campaignId = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: 'gd-devpass-2026' });
  return r.body.data.accessToken as string;
}
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

beforeAll(async () => {
  anaToken = await login('vane@godigital.mk');
  await db.campaign.deleteMany({ where: { name: NAME } });
  clientId = (await db.client.findFirst({ where: { status: 'aktiven', archivedAt: null } }))!.id;
  // Огледало-запис директно (како што го прави sync-от), не преку API.
  const c = await db.campaign.create({
    data: {
      clientId,
      name: NAME,
      metaCampaignId: 'camp_m7_stub',
      objective: 'reach',
      budget: 450,
      periodFrom: new Date('2027-05-01'),
      periodTo: new Date('2027-05-31'),
    },
  });
  campaignId = c.id;
});

afterAll(async () => {
  await db.campaign.deleteMany({ where: { name: NAME } });
  await db.$disconnect();
});

describe('Кампањи (само читање, М7)', () => {
  it('GET листа по клиент ја содржи кампањата', async () => {
    const r = await request(app).get(`/api/campaigns?clientId=${clientId}`).set(bearer(anaToken));
    expect(r.status).toBe(200);
    expect((r.body.data as Array<{ id: string }>).some((c) => c.id === campaignId)).toBe(true);
  });

  it('POST /campaigns повеќе не постои → 404', async () => {
    const r = await request(app)
      .post('/api/campaigns')
      .set(bearer(anaToken))
      .send({ clientId, name: NAME, budget: 100 });
    expect(r.status).toBe(404);
  });

  it('PATCH /campaigns/:id повеќе не постои → 404', async () => {
    const r = await request(app)
      .patch(`/api/campaigns/${campaignId}`)
      .set(bearer(anaToken))
      .send({ budget: 200 });
    expect(r.status).toBe(404);
  });
});
