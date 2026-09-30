import { createHash } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { prisma } from '../db/tenantExtension.js';

/**
 * Интеграциски тестови за заборавена лозинка (H4). Бараат жив Postgres + seed.
 * Ја менуваат лозинката на bojan@godigital.mk и ја ВРАЌААТ на крај за да не пукнат другите тестови.
 */
const app = createApp();
const DEV_PASSWORD = 'gd-devpass-2026';
const sha256 = (v: string): string => createHash('sha256').update(v).digest('hex');

async function mkToken(employeeId: string, token: string, expiresAt: Date): Promise<void> {
  await prisma.passwordResetToken.create({
    data: { tenantId: 'godigital', employeeId, tokenHash: sha256(token), expiresAt },
  });
}

describe('заборавена лозинка (H4)', () => {
  let bojanId = '';

  beforeAll(async () => {
    const b = await prisma.employee.findUnique({ where: { email: 'bojan@godigital.mk' } });
    bojanId = b!.id;
  });

  it('forgot-password за непостоечки е-мејл → 200 без нов токен (без enumeration)', async () => {
    const before = await prisma.passwordResetToken.count();
    const r = await request(app).post('/api/auth/forgot-password').send({ email: 'nema@nikde.mk' });
    expect(r.status).toBe(200);
    expect(await prisma.passwordResetToken.count()).toBe(before);
  });

  it('forgot-password за постоечки → 200 + создаден токен', async () => {
    const r = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'bojan@godigital.mk' });
    expect(r.status).toBe(200);
    const tok = await prisma.passwordResetToken.findFirst({
      where: { employeeId: bojanId, usedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    expect(tok).toBeTruthy();
  });

  it('невалиден внес → 400 VALIDATION_FAILED', async () => {
    const r = await request(app).post('/api/auth/reset-password').send({ token: 'x' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('VALIDATION_FAILED');
  });

  it('reset-password со невалиден токен → 400 RESET_TOKEN_INVALID', async () => {
    const r = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'nepostoi', password: 'novasifra123' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('RESET_TOKEN_INVALID');
  });

  it('reset-password со истечен токен → 400', async () => {
    const token = `expired-${bojanId}`;
    await mkToken(bojanId, token, new Date(Date.now() - 1000));
    const r = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'novasifra123' });
    expect(r.status).toBe(400);
  });

  it('happy path: reset менува лозинка, токен е еднократен, па враќање', async () => {
    const newPass = 'privremena123';
    const token = `valid-${bojanId}`;
    await mkToken(bojanId, token, new Date(Date.now() + 3_600_000));

    const reset = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: newPass });
    expect(reset.status).toBe(200);

    // Новата лозинка работи.
    const login = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bojan@godigital.mk', password: newPass });
    expect(login.status).toBe(200);

    // Токенот е еднократен — повторна употреба → 400.
    const reuse = await request(app)
      .post('/api/auth/reset-password')
      .send({ token, password: 'ushteedna123' });
    expect(reuse.status).toBe(400);

    // Врати ја оригиналната лозинка за другите тестови.
    const restoreToken = `restore-${bojanId}`;
    await mkToken(bojanId, restoreToken, new Date(Date.now() + 3_600_000));
    const restore = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: restoreToken, password: DEV_PASSWORD });
    expect(restore.status).toBe(200);
  });
});
