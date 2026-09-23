import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient, type ContentType, type TaskStatus } from '@gd/db';
import { createApp } from '../app.js';
import { cleanupMonth } from './helpers.js';

/** Интеграциски тест за A3 transition engine (guards → статус → effects → EventLog). */
const app = createApp();
const db = new PrismaClient();
const DEV_PASSWORD = 'gd-devpass-2026';
const MONTH = '2027-01';

let clientId = '';
const empId: Record<string, string> = {};
const token: Record<string, string> = {};
let graphicGroupId = '';
let videoGroupId = '';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}

async function mkTask(
  status: TaskStatus,
  contentType: ContentType,
  groupId: string,
  over: Record<string, unknown> = {},
): Promise<string> {
  const t = await db.task.create({
    data: { groupId, clientId, contentType, title: `тест ${status}`, status, ...over },
  });
  return t.id;
}

const bearer = (role: string) => ({ Authorization: `Bearer ${token[role]}` });

beforeAll(async () => {
  const emps = await db.employee.findMany();
  for (const e of emps) empId[e.role] = e.id;
  const byRole: Record<string, string> = {
    dir: 'aleks@godigital.mk',
    am: 'tamara@godigital.mk',
    rez: 'stefan@godigital.mk',
    mon: 'dejan@godigital.mk',
    krea: 'ljubica@godigital.mk',
    diz: 'dragan@godigital.mk',
    ana: 'vane@godigital.mk',
  };
  for (const [role, email] of Object.entries(byRole)) token[role] = await login(email);

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

describe('A3 transition engine', () => {
  it('дозволен преод brifing→dizajn (текст+доделен) успева', async () => {
    const id = await mkTask('brifing', 'graphic', graphicGroupId, { kreaId: empId.krea });
    const r = await request(app)
      .post(`/api/tasks/${id}/transition`)
      .set(bearer('krea'))
      .send({
        to: 'dizajn',
        payload: {
          brief: 'Брифинг со доволно долг текст над педесет знаци за валидација ок.',
          assigneeId: empId.diz,
        },
      });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('dizajn');
    expect(r.body.data.assigneeId).toBe(empId.diz);
  });

  it('погрешна улога → 403 FORBIDDEN_ROLE', async () => {
    const id = await mkTask('brifing', 'graphic', graphicGroupId);
    const r = await request(app)
      .post(`/api/tasks/${id}/transition`)
      .set(bearer('mon'))
      .send({ to: 'dizajn', payload: { brief: 'x'.repeat(60), assigneeId: empId.diz } });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('недостасува внес → 400 GUARD_FAILED со missing[]', async () => {
    const id = await mkTask('brifing', 'graphic', graphicGroupId);
    const r = await request(app)
      .post(`/api/tasks/${id}/transition`)
      .set(bearer('krea'))
      .send({ to: 'dizajn' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('GUARD_FAILED');
    expect(r.body.details.missing).toContain('brief');
    expect(r.body.details.missing).toContain('assignee');
  });

  it('самоодобрување → SELF_APPROVAL', async () => {
    const id = await mkTask('brifing', 'graphic', graphicGroupId, { kreaId: empId.krea });
    const r = await request(app)
      .post(`/api/tasks/${id}/transition`)
      .set(bearer('krea'))
      .send({ to: 'dizajn', payload: { brief: 'x'.repeat(60), assigneeId: empId.krea } });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('SELF_APPROVAL');
  });

  it('преод надвор од матрицата → TRANSITION_NOT_ALLOWED', async () => {
    const id = await mkTask('brifing', 'graphic', graphicGroupId);
    const r = await request(app)
      .post(`/api/tasks/${id}/transition`)
      .set(bearer('krea'))
      .send({ to: 'objaveno' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('TRANSITION_NOT_ALLOWED');
  });

  it('враќање vnatresno→dizajn бара коментар + прави ревизија и нова верзија', async () => {
    const id = await mkTask('vnatresno', 'graphic', graphicGroupId, {
      kreaId: empId.krea,
      version: 1,
    });
    const noComment = await request(app)
      .post(`/api/tasks/${id}/transition`)
      .set(bearer('krea'))
      .send({ to: 'dizajn' });
    expect(noComment.status).toBe(400);
    expect(noComment.body.details.missing).toContain('comment');

    const ok = await request(app)
      .post(`/api/tasks/${id}/transition`)
      .set(bearer('krea'))
      .send({ to: 'dizajn', payload: { comment: 'Промени го фонтот.' } });
    expect(ok.status).toBe(200);
    expect(ok.body.data.version).toBe(2);
    const revisions = await db.revision.count({ where: { taskId: id } });
    expect(revisions).toBe(1);
  });

  it('видео chekaRezija→montaza (rez доделува монтажер)', async () => {
    const id = await mkTask('chekaRezija', 'video', videoGroupId, { rezId: empId.rez });
    const r = await request(app)
      .post(`/api/tasks/${id}/transition`)
      .set(bearer('rez'))
      .send({ to: 'montaza', payload: { assigneeId: empId.mon } });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('montaza');
    expect(r.body.data.assigneeId).toBe(empId.mon);
  });

  it('E_AUTO_NEXT: objaveno → analitika кога клиентот има Meta Ads (D-6)', async () => {
    const id = await mkTask('zaObjavuvanje', 'graphic', graphicGroupId, { copy: 'Копи текст' });
    await db.publication.create({
      data: {
        taskId: id,
        platform: 'ig',
        postType: 'post',
        permalink: 'https://instagram.com/p/abc123',
      },
    });
    const r = await request(app)
      .post(`/api/tasks/${id}/transition`)
      .set(bearer('am'))
      .send({ to: 'objaveno', payload: {} });
    expect(r.status).toBe(200);
    expect(r.body.data.status).toBe('analitika');
  });

  it('zaObjavuvanje→objaveno без копи и линк → GUARD_FAILED (§18 A6)', async () => {
    // Таск во „За објавување" без copy и без публикација — не смее да помине во Објавено.
    const id = await mkTask('zaObjavuvanje', 'graphic', graphicGroupId);
    const r = await request(app)
      .post(`/api/tasks/${id}/transition`)
      .set(bearer('am'))
      .send({ to: 'objaveno', payload: {} });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('GUARD_FAILED');
    expect(r.body.details.missing).toContain('copy');
    expect(r.body.details.missing).toContain('publication');
    // Статусот останува непроменет.
    const after = await db.task.findUnique({ where: { id } });
    expect(after?.status).toBe('zaObjavuvanje');
  });

  it('Директор може наместо друга улога со причина (D-5)', async () => {
    const id = await mkTask('brifing', 'graphic', graphicGroupId, { kreaId: empId.krea });
    const noReason = await request(app)
      .post(`/api/tasks/${id}/transition`)
      .set(bearer('dir'))
      .send({ to: 'dizajn', payload: { brief: 'x'.repeat(60), assigneeId: empId.diz } });
    expect(noReason.status).toBe(400); // причина задолжителна
    const ok = await request(app)
      .post(`/api/tasks/${id}/transition`)
      .set(bearer('dir'))
      .send({
        to: 'dizajn',
        payload: { brief: 'x'.repeat(60), assigneeId: empId.diz, reason: 'Гр. креатор отсутен.' },
      });
    expect(ok.status).toBe(200);
  });
});
