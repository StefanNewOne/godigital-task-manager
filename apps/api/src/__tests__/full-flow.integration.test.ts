import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { cleanupMonth } from './helpers.js';

/**
 * A3 gate (§18): еден таск поминува низ ЦЕЛИОТ графички тек преку state machine —
 * mrtov → brifing → dizajn → vnatresno → kajKlient → zaObjavuvanje → objaveno → analitika → zavrseno.
 * Секој чекор е реален transition повик со точната улога и внес што ги задоволува guards.
 */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const MONTH = '2027-05';

let clientId = '';
const empId: Record<string, string> = {};
const token: Record<string, string> = {};
let graphicGroupId = '';
let videoGroupId = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}
const bearer = (role: string) => ({ Authorization: `Bearer ${token[role]}` });

function transition(id: string, role: string, to: string, payload: Record<string, unknown> = {}) {
  return request(app).post(`/api/tasks/${id}/transition`).set(bearer(role)).send({ to, payload });
}

beforeAll(async () => {
  const emps = await db.employee.findMany();
  for (const e of emps) empId[e.role] = e.id;
  const byRole: Record<string, string> = {
    am: 'tamara@godigital.mk',
    rez: 'stefan@godigital.mk',
    mon: 'dejan@godigital.mk',
    krea: 'ljubica@godigital.mk',
    diz: 'dragan@godigital.mk',
    ana: 'vane@godigital.mk',
  };
  for (const [role, email] of Object.entries(byRole)) token[role] = await login(email);

  // „Ресторан ИВ" има usesMetaAds=true → objaveno авто-продолжува во analitika (D-6).
  const client = await db.client.findFirst({ where: { name: 'Ресторан ИВ' } });
  clientId = client!.id;

  await cleanupMonth(db, MONTH);
  graphicGroupId = (
    await db.taskGroup.create({
      data: {
        clientId,
        contentType: 'graphic',
        monthKey: MONTH,
        status: 'zatvoren',
        plannedCount: 8,
      },
    })
  ).id;
  videoGroupId = (
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
});

describe('A3 — целиот графички тек', () => {
  it('mrtov → … → zavrseno поминува секој преод со точната улога', async () => {
    const task = await db.task.create({
      data: {
        groupId: graphicGroupId,
        clientId,
        contentType: 'graphic',
        title: 'цел тек',
        status: 'mrtov',
      },
    });
    const id = task.id;

    // 1) mrtov → brifing (krea отвора слот)
    expect((await transition(id, 'krea', 'brifing')).body.data.status).toBe('brifing');

    // 2) brifing → dizajn (krea: брифинг ≥50 + доделен дизајнер)
    const r2 = await transition(id, 'krea', 'dizajn', {
      brief: 'Дизајн за месечна кампања — сина позадина, лого горе десно, бел текст.',
      assigneeId: empId.diz,
    });
    expect(r2.body.data.status).toBe('dizajn');
    expect(r2.body.data.assigneeId).toBe(empId.diz);

    // E_NOTIFY (#1): дизајнерот доби in-app известување дека има нова задача.
    const dizNotif = await db.notification.findFirst({
      where: { recipientId: empId.diz, taskId: id, eventKey: 'task_new' },
    });
    expect(dizNotif, 'дизајнерот треба да добие известување за нова задача').toBeTruthy();

    // 3) dizajn → vnatresno (diz: бара прикачена графика)
    await db.fileAsset.create({
      data: {
        ownerType: 'task',
        ownerId: id,
        kind: 'graphic',
        r2Key: `tasks/${id}/design-v1.png`,
        size: BigInt(204_800),
        mime: 'image/png',
        version: 1,
        uploadedById: empId.diz,
      },
    });
    expect((await transition(id, 'diz', 'vnatresno')).body.data.status).toBe('vnatresno');

    // 4) vnatresno → kajKlient (krea: внатрешно одобрено)
    expect((await transition(id, 'krea', 'kajKlient')).body.data.status).toBe('kajKlient');

    // 5) kajKlient → zaObjavuvanje (krea: клиент одобрил)
    const r5 = await transition(id, 'krea', 'zaObjavuvanje', { outcome: 'approved' });
    expect(r5.body.data.status).toBe('zaObjavuvanje');

    // 6) zaObjavuvanje → objaveno (am: копи + објава со линк) → авто analitika (usesMetaAds)
    await db.publication.create({
      data: {
        taskId: id,
        platform: 'ig',
        postType: 'post',
        permalink: 'https://instagram.com/p/FullFlow1',
      },
    });
    const r6 = await transition(id, 'am', 'objaveno', { copy: 'Копи текст за објавата.' });
    expect(r6.status).toBe(200);
    expect(r6.body.data.status).toBe('analitika');

    // 7) analitika → zavrseno (ana: одлука органски/платено преку Promotion)
    const pub = await db.publication.findFirst({ where: { taskId: id } });
    await db.promotion.create({ data: { publicationId: pub!.id, decision: 'organic' } });
    const r7 = await transition(id, 'ana', 'zavrseno');
    expect(r7.status).toBe(200);
    expect(r7.body.data.status).toBe('zavrseno');

    // Ревизии нема (нема враќања); статусот е терминален.
    const final = await db.task.findUnique({ where: { id } });
    expect(final?.status).toBe('zavrseno');
  });

  it('видео: chekaRezija → montaza → … → zavrseno (актерски дел)', async () => {
    // Раниот дел (mrtov→cekaSnimanje→chekaRezija) е system/capa-воден — покриен во капа тестовите.
    const task = await db.task.create({
      data: {
        groupId: videoGroupId,
        clientId,
        contentType: 'video',
        title: 'видео тек',
        status: 'chekaRezija',
        rezId: empId.rez,
      },
    });
    const id = task.id;

    // 1) chekaRezija → montaza (rez доделува монтажер)
    const r1 = await transition(id, 'rez', 'montaza', { assigneeId: empId.mon });
    expect(r1.body.data.status).toBe('montaza');
    expect(r1.body.data.assigneeId).toBe(empId.mon);

    // 2) montaza → vnatresno (mon: бара финално видео)
    await db.fileAsset.create({
      data: {
        ownerType: 'task',
        ownerId: id,
        kind: 'final',
        r2Key: `tasks/${id}/final-v1.mp4`,
        size: BigInt(52_428_800),
        mime: 'video/mp4',
        version: 1,
        uploadedById: empId.mon,
      },
    });
    expect((await transition(id, 'mon', 'vnatresno')).body.data.status).toBe('vnatresno');

    // 3) vnatresno → kajKlient (rez: внатрешно одобрено)
    expect((await transition(id, 'rez', 'kajKlient')).body.data.status).toBe('kajKlient');

    // 4) kajKlient → zaObjavuvanje (rez: клиент одобрил)
    expect(
      (await transition(id, 'rez', 'zaObjavuvanje', { outcome: 'approved' })).body.data.status,
    ).toBe('zaObjavuvanje');

    // 5) zaObjavuvanje → objaveno (am: копи + објава) → авто analitika
    await db.publication.create({
      data: {
        taskId: id,
        platform: 'fb',
        postType: 'reel',
        permalink: 'https://facebook.com/reel/998877',
      },
    });
    const r5 = await transition(id, 'am', 'objaveno', { copy: 'Копи за видеото.' });
    expect(r5.body.data.status).toBe('analitika');

    // 6) analitika → zavrseno (ana: одлука)
    const pub = await db.publication.findFirst({ where: { taskId: id } });
    await db.promotion.create({ data: { publicationId: pub!.id, decision: 'paid' } });
    expect((await transition(id, 'ana', 'zavrseno')).body.data.status).toBe('zavrseno');
  });
});
