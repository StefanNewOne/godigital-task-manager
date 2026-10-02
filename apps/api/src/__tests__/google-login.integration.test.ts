import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import { setGoogleVerifier } from '../lib/googleAuth.js';

/**
 * Google најава (ADR-002). Верификаторот е мокиран (не вика Google). GOOGLE_CLIENT_ID е сетиран
 * преку vitest.integration.config. Гејт: @godigital.mk + verified + постоечки активен Employee.
 */
const app = createApp();

beforeAll(() => {
  setGoogleVerifier(async (idToken: string) => {
    switch (idToken) {
      case 'ok-dir':
        return { email: 'aleks@godigital.mk', emailVerified: true, sub: 'g-dir' };
      case 'foreign-domain':
        return { email: 'someone@gmail.com', emailVerified: true, sub: 'g-foreign' };
      case 'unknown-employee':
        return { email: 'nobody@godigital.mk', emailVerified: true, sub: 'g-unknown' };
      case 'unverified':
        return { email: 'aleks@godigital.mk', emailVerified: false, sub: 'g-unverified' };
      default:
        throw new Error('bad token');
    }
  });
});

afterAll(() => {
  setGoogleVerifier(null);
});

describe('Google најава (POST /auth/google)', () => {
  it('config ја изложува GOOGLE_CLIENT_ID (без секрети)', async () => {
    const r = await request(app).get('/api/auth/config');
    expect(r.status).toBe(200);
    expect(r.body.data.googleClientId).toBe('test.apps.googleusercontent.com');
  });

  it('@godigital.mk + verified + постоечки Employee → 200 + cookie', async () => {
    const r = await request(app).post('/api/auth/google').send({ idToken: 'ok-dir' });
    expect(r.status).toBe(200);
    expect(r.body.data.employee.role).toBe('dir');
    expect(r.body.data.accessToken).toBeTruthy();
    const cookies = ([] as string[]).concat(r.headers['set-cookie'] ?? []);
    expect(cookies.join(';')).toMatch(/access_token=/);
  });

  it('туѓ домен → 403', async () => {
    const r = await request(app).post('/api/auth/google').send({ idToken: 'foreign-domain' });
    expect(r.status).toBe(403);
    expect(r.body.code).toBe('FORBIDDEN_ROLE');
  });

  it('непостоечки вработен → 403', async () => {
    const r = await request(app).post('/api/auth/google').send({ idToken: 'unknown-employee' });
    expect(r.status).toBe(403);
  });

  it('неверификуван email → 403', async () => {
    const r = await request(app).post('/api/auth/google').send({ idToken: 'unverified' });
    expect(r.status).toBe(403);
  });

  it('невалиден токен → 401', async () => {
    const r = await request(app).post('/api/auth/google').send({ idToken: 'garbage' });
    expect(r.status).toBe(401);
  });

  it('без idToken → 400 VALIDATION_FAILED', async () => {
    const r = await request(app).post('/api/auth/google').send({});
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('VALIDATION_FAILED');
  });
});
