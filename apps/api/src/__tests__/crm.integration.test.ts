import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';

/**
 * Модул 2 · Продажен CRM — цел пайплајн од прв контакт до активација.
 * Проверува: видливост (агент свои / директор сите), guards по чекор, директорско
 * одобрување/враќање (нова верзија), состанок, пакет, content планер, активација
 * (Client + мртви слотови), изгубен + реактивација.
 */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const MONTH = '2033-03';
const LEAD_NAME = 'ТЕСТ CRM Пипелина';
const LOST_NAME = 'ТЕСТ CRM Изгубен';

let marija = '';
let bojan = '';
let dir = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}

function tr(token: string, id: string, to: string, payload?: unknown) {
  return request(app)
    .post(`/api/crm/leads/${id}/transition`)
    .set({ Authorization: `Bearer ${token}` })
    .send({ to, payload });
}
let fileSeq = 0;
function nextFileId(): string {
  fileSeq += 1;
  return `00000000-0000-7000-8000-${String(fileSeq).padStart(12, '0')}`;
}
function doc(token: string, id: string, kind: string) {
  return request(app)
    .post(`/api/crm/leads/${id}/docs`)
    .set({ Authorization: `Bearer ${token}` })
    .send({ kind, fileId: nextFileId() });
}

async function cleanup() {
  for (const name of [LEAD_NAME, LOST_NAME]) {
    const leads = await db.lead.findMany({ where: { name } });
    for (const l of leads) {
      await db.leadOffer.deleteMany({ where: { leadId: l.id } });
      await db.leadContract.deleteMany({ where: { leadId: l.id } });
      await db.contentPlanEntry.deleteMany({ where: { leadId: l.id } });
      await db.fileAsset.deleteMany({ where: { ownerType: 'lead', ownerId: l.id } });
      // EventLog е append-only (И6) — не се брише; нема FK кон лидот.
      await db.lead.delete({ where: { id: l.id } });
    }
  }
  const clients = await db.client.findMany({ where: { name: LEAD_NAME } });
  for (const c of clients) {
    await db.task.deleteMany({ where: { clientId: c.id } });
    await db.taskGroup.deleteMany({ where: { clientId: c.id } });
    await db.publishingSlot.deleteMany({ where: { clientId: c.id } });
    await db.monthlyPlanClient.deleteMany({ where: { clientId: c.id } });
    await db.client.delete({ where: { id: c.id } });
  }
}

beforeAll(async () => {
  marija = await login('marija@godigital.mk');
  bojan = await login('bojan@godigital.mk');
  dir = await login('aleks@godigital.mk');
  await cleanup();
});

afterAll(async () => {
  await cleanup();
  await db.$disconnect();
});

describe('CRM · видливост и дозволи', () => {
  it('Продажен агент нема пристап до screen-gated Модул 1 екран (shoot-calendar 403)', async () => {
    const r = await request(app)
      .get('/api/shoot-calendar')
      .set({ Authorization: `Bearer ${marija}` });
    expect(r.status).toBe(403);
  });

  it('Не-продажна улога нема пристап до CRM', async () => {
    const rez = await login('stefan@godigital.mk');
    const r = await request(app)
      .get('/api/crm/leads')
      .set({ Authorization: `Bearer ${rez}` });
    expect(r.status).toBe(403);
  });
});

describe('CRM · цел пайплајн + активација', () => {
  let leadId = '';

  it('агент креира лид на себе', async () => {
    const r = await request(app)
      .post('/api/crm/leads')
      .set({ Authorization: `Bearer ${marija}` })
      .send({ name: LEAD_NAME, source: 'Instagram', person: 'Тест Лице', phone: '070 000 000' });
    expect(r.status).toBe(201);
    expect(r.body.data.status).toBe('novLid');
    leadId = r.body.data.id;
  });

  it('видливост: сопственикот и Директорот го гледаат; друг агент — не', async () => {
    const mine = await request(app)
      .get('/api/crm/leads')
      .set({ Authorization: `Bearer ${marija}` });
    expect(mine.body.data.some((l: { id: string }) => l.id === leadId)).toBe(true);
    const other = await request(app)
      .get('/api/crm/leads')
      .set({ Authorization: `Bearer ${bojan}` });
    expect(other.body.data.some((l: { id: string }) => l.id === leadId)).toBe(false);
    const all = await request(app)
      .get('/api/crm/leads')
      .set({ Authorization: `Bearer ${dir}` });
    expect(all.body.data.some((l: { id: string }) => l.id === leadId)).toBe(true);
  });

  it('туѓ агент не смее да дејствува (403)', async () => {
    const r = await tr(bojan, leadId, 'analiza');
    expect(r.status).toBe(403);
  });

  it('lead документ: сопственикот може presign (R2), туѓ агент не (403)', async () => {
    const body = {
      ownerType: 'lead',
      ownerId: leadId,
      kind: 'leadDoc',
      mime: 'application/pdf',
      size: 2048,
    };
    const mine = await request(app)
      .post('/api/files/presign')
      .set({ Authorization: `Bearer ${marija}` })
      .send(body);
    expect(mine.status).toBe(201);
    expect(mine.body.data.fileId).toBeTruthy();
    expect(mine.body.data.mode).toBe('single');
    const other = await request(app)
      .post('/api/files/presign')
      .set({ Authorization: `Bearer ${bojan}` })
      .send(body);
    expect(other.status).toBe(403);
  });

  it('novLid → analiza (без guard)', async () => {
    const r = await tr(marija, leadId, 'analiza');
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('analiza');
  });

  it('analiza → ponudaIzr блокирано без документ за анализа', async () => {
    const r = await tr(marija, leadId, 'ponudaIzr');
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('GUARD_FAILED');
  });

  it('по прикачена анализа → ponudaIzr', async () => {
    await doc(marija, leadId, 'analysis');
    const r = await tr(marija, leadId, 'ponudaIzr');
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('ponudaIzr');
  });

  it('ponudaIzr → ponudaOdob бара понуда; по v1 поминува', async () => {
    expect((await tr(marija, leadId, 'ponudaOdob')).status).toBe(400);
    await doc(marija, leadId, 'offer');
    const r = await tr(marija, leadId, 'ponudaOdob');
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('ponudaOdob');
  });

  it('агент не може да одобри (директорски чекор, 403)', async () => {
    expect((await tr(marija, leadId, 'ponudaKlient')).status).toBe(403);
  });

  it('директор враќа со коментар → назад во ponudaIzr, ret на v1', async () => {
    const r = await tr(dir, leadId, 'ponudaIzr', { comment: 'Коригирај цена.' });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('ponudaIzr');
    const offers = r.body.data.offers as Array<{ version: number; ret: string | null }>;
    expect(offers.find((o) => o.version === 1)?.ret).toBe('Коригирај цена.');
  });

  it('враќање бара нова верзија понуда (v2), па директор одобрува', async () => {
    expect((await tr(marija, leadId, 'ponudaOdob')).status).toBe(400); // v1 вратена
    await doc(marija, leadId, 'offer'); // v2
    expect((await tr(marija, leadId, 'ponudaOdob')).status).toBe(200);
    const r = await tr(dir, leadId, 'ponudaKlient');
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('ponudaKlient');
  });

  it('ponudaKlient → sostanok (клиент прифати)', async () => {
    const r = await tr(marija, leadId, 'sostanok');
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('sostanok');
  });

  it('sostanok → dogIzr бара состанок; по внес поминува', async () => {
    expect((await tr(marija, leadId, 'dogIzr')).status).toBe(400);
    await request(app)
      .put(`/api/crm/leads/${leadId}/meeting`)
      .set({ Authorization: `Bearer ${marija}` })
      .send({ date: `${MONTH}-10T00:00:00.000Z`, time: '10:00', held: true, notes: 'Согласни.' });
    const r = await tr(marija, leadId, 'dogIzr');
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('dogIzr');
  });

  it('dogIzr → dogOdob бара пакет + договор; по внес поминува', async () => {
    expect((await tr(marija, leadId, 'dogOdob')).status).toBe(400);
    await request(app)
      .put(`/api/crm/leads/${leadId}/package`)
      .set({ Authorization: `Bearer ${marija}` })
      .send({
        videos: 1,
        graphics: 1,
        meta: false,
        start: MONTH,
        months: 6,
        calType: 'specificen',
      });
    await doc(marija, leadId, 'contract');
    const r = await tr(marija, leadId, 'dogOdob');
    expect(r.status).toBe(200);
  });

  it('директор одобрува договор → dogKlient', async () => {
    const r = await tr(dir, leadId, 'dogKlient');
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('dogKlient');
  });

  it('dogKlient → strategija бара потпишан договор', async () => {
    expect((await tr(marija, leadId, 'strategija')).status).toBe(400);
    await doc(marija, leadId, 'signed');
    const r = await tr(marija, leadId, 'strategija');
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('strategija');
  });

  it('strategija → aktivacija бара стратегија+Fable+планер', async () => {
    expect((await tr(marija, leadId, 'aktivacija')).status).toBe(400);
    await doc(marija, leadId, 'strategy');
    await doc(marija, leadId, 'fable');
    // планер: 3 месеци × (1 видео + 1 графика)
    const entries = ['2033-03', '2033-04', '2033-05'].flatMap((m) => [
      { monthKey: m, day: 6, contentType: 'video' },
      { monthKey: m, day: 13, contentType: 'graphic' },
    ]);
    await request(app)
      .put(`/api/crm/leads/${leadId}/plan`)
      .set({ Authorization: `Bearer ${marija}` })
      .send({ entries });
    const r = await tr(marija, leadId, 'aktivacija');
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('aktivacija');
    expect(r.body.data.team).toBeTruthy();
  });

  it('aktivacija → aktiviran создава Client + мртви слотови', async () => {
    const r = await tr(marija, leadId, 'aktiviran');
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('aktiviran');
    const clientId = r.body.data.activatedClientId as string;
    expect(clientId).toBeTruthy();

    const client = await db.client.findUnique({ where: { id: clientId } });
    expect(client?.videosPerMonth).toBe(1);
    expect(client?.graphicsPerMonth).toBe(1);
    expect(client?.calendarType).toBe('specificen');

    const slots = await db.publishingSlot.findMany({ where: { clientId, monthKey: MONTH } });
    expect(slots).toHaveLength(2); // 1 видео + 1 графика за првиот месец
    expect(slots.every((s) => s.status === 'reserved')).toBe(true);
    const tasks = await db.task.findMany({ where: { clientId } });
    expect(tasks).toHaveLength(2);
    expect(tasks.every((t) => t.status === 'mrtov')).toBe(true);
    const groups = await db.taskGroup.findMany({ where: { clientId } });
    expect(groups).toHaveLength(2);
  });
});

describe('CRM · изгубен + реактивација', () => {
  let leadId = '';

  it('подготви лид до ponudaKlient', async () => {
    const c = await request(app)
      .post('/api/crm/leads')
      .set({ Authorization: `Bearer ${marija}` })
      .send({ name: LOST_NAME, source: 'Facebook', person: 'Изгубен Тест', phone: '071' });
    leadId = c.body.data.id;
    await tr(marija, leadId, 'analiza');
    await doc(marija, leadId, 'analysis');
    await tr(marija, leadId, 'ponudaIzr');
    await doc(marija, leadId, 'offer');
    await tr(marija, leadId, 'ponudaOdob');
    await tr(dir, leadId, 'ponudaKlient');
    const g = await request(app)
      .get(`/api/crm/leads/${leadId}`)
      .set({ Authorization: `Bearer ${marija}` });
    expect(g.body.data.status).toBe('ponudaKlient');
  });

  it('изгубен бара причина; „Друго" бара белешка', async () => {
    expect((await tr(marija, leadId, 'izguben', {})).status).toBe(400);
    expect((await tr(marija, leadId, 'izguben', { lossReason: 'Друго' })).status).toBe(400);
    const r = await tr(marija, leadId, 'izguben', { lossReason: 'Цена' });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('izguben');
    expect(r.body.data.lossReason).toBe('Цена');
    expect(r.body.data.lostFromStatus).toBe('ponudaKlient');
  });

  it('реактивација → назад во ponudaIzr, изчистен lost', async () => {
    const r = await tr(marija, leadId, 'ponudaIzr');
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('ponudaIzr');
    expect(r.body.data.lossReason).toBeNull();
    expect(r.body.data.lostFromStatus).toBeNull();
  });
});
