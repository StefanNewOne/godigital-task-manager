import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { generateProposalSlots } from '../services/slots.js';

/**
 * Парче 2 (редизайн): стандарден календар (clientId=null). Клиент со calendarType=standarden
 * и без посебен календар го користи стандардниот при генерирање слотови. Само АМ/Директор уредува.
 */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const MONTH = '2029-03';

let amToken = '';
let rezToken = '';
let clientId = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}

beforeAll(async () => {
  amToken = await login('tamara@godigital.mk');
  rezToken = await login('stefan@godigital.mk');

  const client = await db.client.create({
    data: {
      name: 'ТЕСТ Стандарден Календар',
      color: '#334155',
      contractStart: new Date(Date.UTC(2029, 0, 1)),
      contractMonths: 12,
      videosPerMonth: 4,
      graphicsPerMonth: 0,
      calendarType: 'standarden',
    },
  });
  clientId = client.id;

  // Стандарден видео календар: само понеделник (weekday 1).
  await request(app)
    .put('/api/calendar/standard')
    .set({ Authorization: `Bearer ${amToken}` })
    .send({ contentType: 'video', weekdays: [1], publishTime: '10:00', allowTwoPerDay: false });
});

afterAll(async () => {
  await db.publishingSlot.deleteMany({ where: { clientId } });
  await db.client.delete({ where: { id: clientId } });
  await db.calendarConfig.deleteMany({ where: { clientId: null } });
  await db.$disconnect();
});

describe('Стандарден календар (Парче 2)', () => {
  it('Режисер не може да уредува стандарден календар (403)', async () => {
    const r = await request(app)
      .put('/api/calendar/standard')
      .set({ Authorization: `Bearer ${rezToken}` })
      .send({ contentType: 'video', weekdays: [3], publishTime: '10:00', allowTwoPerDay: false });
    expect(r.status).toBe(403);
  });

  it('GET враќа зачуван стандарден видео календар', async () => {
    const r = await request(app)
      .get('/api/calendar/standard')
      .set({ Authorization: `Bearer ${amToken}` });
    expect(r.status).toBe(200);
    const video = (r.body.data as Array<{ contentType: string; weekdays: number[] }>).find(
      (c) => c.contentType === 'video',
    );
    expect(video?.weekdays).toEqual([1]);
  });

  it('standarden клиент без посебен календар генерира слотови по стандардниот (само понеделник)', async () => {
    const slots = await generateProposalSlots(clientId, MONTH);
    const video = slots.filter((s) => s.contentType === 'video');
    expect(video.length).toBeGreaterThan(0);
    for (const s of video) {
      expect(new Date(s.date).getUTCDay()).toBe(1); // понеделник
    }
  });
});
