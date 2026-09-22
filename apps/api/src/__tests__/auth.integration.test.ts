import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';

/**
 * Интеграциски тестови (бараат жив Postgres со seed податоци + JWT env).
 * Пример:
 *   DATABASE_URL=... JWT_ACCESS_SECRET=... JWT_REFRESH_SECRET=... \
 *   pnpm --filter @gd/api exec vitest run
 */
const app = createApp();
const DEV_PASSWORD = 'gd-devpass-2026';

async function login(email: string): Promise<string> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  return r.body.data.accessToken as string;
}

describe('auth + RBAC + tenant scope', () => {
  let dirToken = '';

  beforeAll(async () => {
    dirToken = await login('aleks@godigital.mk');
  });

  it('GET /health → 200', async () => {
    const r = await request(app).get('/health');
    expect(r.status).toBe(200);
    expect(r.body.ok).toBe(true);
  });

  it('логин со точни креденцијали враќа Директор', async () => {
    const r = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aleks@godigital.mk', password: DEV_PASSWORD });
    expect(r.status).toBe(200);
    expect(r.body.data.employee.role).toBe('dir');
    expect(typeof r.body.data.accessToken).toBe('string');
  });

  it('погрешна лозинка → 401 UNAUTHENTICATED', async () => {
    const r = await request(app)
      .post('/api/auth/login')
      .send({ email: 'aleks@godigital.mk', password: 'wrong' });
    expect(r.status).toBe(401);
    expect(r.body.code).toBe('UNAUTHENTICATED');
  });

  it('GET /api/me со токен', async () => {
    const r = await request(app).get('/api/me').set('Authorization', `Bearer ${dirToken}`);
    expect(r.status).toBe(200);
    expect(r.body.data.email).toBe('aleks@godigital.mk');
  });

  it('GET /api/clients без auth → 401', async () => {
    const r = await request(app).get('/api/clients');
    expect(r.status).toBe(401);
  });

  it('не-Директор не може да создаде клиент → 403 FORBIDDEN_ROLE', async () => {
    const monToken = await login('dejan@godigital.mk'); // Монтажер
    const r = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${monToken}`)
      .send({ name: 'Тест', color: '#000000', contractStart: '2026-01-01', contractMonths: 12 });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('Директорот ги гледа seed клиентите, сите со tenantId=godigital', async () => {
    const r = await request(app).get('/api/clients').set('Authorization', `Bearer ${dirToken}`);
    expect(r.status).toBe(200);
    expect(r.body.data.length).toBeGreaterThanOrEqual(6);
    const rows = r.body.data as Array<{ tenantId: string }>;
    expect(rows.every((c) => c.tenantId === 'godigital')).toBe(true);
  });

  it('невалиден внес → 400 VALIDATION_FAILED', async () => {
    const r = await request(app)
      .post('/api/clients')
      .set('Authorization', `Bearer ${dirToken}`)
      .send({ name: '' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('VALIDATION_FAILED');
  });
});
