import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PERMISSIONS, type Role } from '@gd/core';
import { createApp } from '../app.js';

/**
 * Мулти-ролна проверка (CLAUDE.md §13, табеларно): за секоја од 9-те улоги проверуваме дека
 * серверот ги спроведува дозволите од `PERMISSIONS` — логин, идентитет, опсег (own/all) и
 * write-порти (клиенти/вработени/празници само Директор). Не-мутирачки: write-портите се
 * гаѓаат со празно тело, па не-Директор паѓа на 403 пред валидација, а Директор на 400.
 */
const app = createApp();
const DEV_PASSWORD = 'gd-devpass-2026';

const ACCOUNTS: Array<{ role: Role; email: string; name: string }> = [
  { role: 'dir', email: 'aleks@godigital.mk', name: 'Алекс К.' },
  { role: 'am', email: 'tamara@godigital.mk', name: 'Тамара С.' },
  { role: 'rez', email: 'stefan@godigital.mk', name: 'Стефан Б.' },
  { role: 'scen', email: 'ilija@godigital.mk', name: 'Илија Н.' },
  { role: 'kam', email: 'nikola@godigital.mk', name: 'Никола П.' },
  { role: 'mon', email: 'dejan@godigital.mk', name: 'Дејан Т.' },
  { role: 'krea', email: 'ljubica@godigital.mk', name: 'Љубица М.' },
  { role: 'diz', email: 'dragan@godigital.mk', name: 'Драган В.' },
  { role: 'ana', email: 'vane@godigital.mk', name: 'Ване Ѓ.' },
];

interface Session {
  token: string;
  employeeId: string;
}

async function login(email: string): Promise<Session> {
  const r = await request(app).post('/api/auth/login').send({ email, password: DEV_PASSWORD });
  expect(r.status, `логин за ${email}`).toBe(200);
  return {
    token: r.body.data.accessToken as string,
    employeeId: r.body.data.employee.id as string,
  };
}

describe('мулти-ролна RBAC проверка (сите 9 улоги)', () => {
  const sessions = new Map<Role, Session>();

  beforeAll(async () => {
    for (const a of ACCOUNTS) sessions.set(a.role, await login(a.email));
  });

  it('секоја улога се најавува и враќа точна улога + идентитет', async () => {
    for (const a of ACCOUNTS) {
      const s = sessions.get(a.role)!;
      const r = await request(app).get('/api/me').set('Authorization', `Bearer ${s.token}`);
      expect(r.status, `me за ${a.role}`).toBe(200);
      expect(r.body.data.role, `улога за ${a.email}`).toBe(a.role);
      expect(r.body.data.email).toBe(a.email);
    }
  });

  it('GET /api/tasks почитува опсег: own гледа само свои, all гледа туѓи', async () => {
    for (const a of ACCOUNTS) {
      const s = sessions.get(a.role)!;
      const r = await request(app)
        .get('/api/tasks?month=2026-09')
        .set('Authorization', `Bearer ${s.token}`);
      expect(r.status, `tasks за ${a.role}`).toBe(200);
      const tasks = r.body.data as Array<{ assigneeId: string | null }>;
      const scope = PERMISSIONS[a.role].scope;
      if (scope === 'own') {
        // Секој видлив таск мора да е доделен точно на овој вработен.
        expect(
          tasks.every((t) => t.assigneeId === s.employeeId),
          `${a.role} (own) не смее да гледа туѓи таскови`,
        ).toBe(true);
      } else {
        // 'all' гледа таскови доделени на други (или недоделени) — не е ограничен на себе.
        expect(
          tasks.some((t) => t.assigneeId !== s.employeeId),
          `${a.role} (all) треба да гледа и туѓи таскови`,
        ).toBe(true);
      }
    }
  });

  it('POST /api/clients: само Директор поминува ролната порта', async () => {
    for (const a of ACCOUNTS) {
      const s = sessions.get(a.role)!;
      const r = await request(app)
        .post('/api/clients')
        .set('Authorization', `Bearer ${s.token}`)
        .send({});
      if (a.role === 'dir') {
        expect(r.status, 'Директор поминува порта → 400 валидација').toBe(400);
        expect(r.body.code).toBe('VALIDATION_FAILED');
      } else {
        expect(r.status, `${a.role} не смее да создава клиент`).toBe(403);
        expect(r.body.code).toBe('FORBIDDEN_ROLE');
      }
    }
  });

  it('POST /api/employees: само Директор поминува ролната порта', async () => {
    for (const a of ACCOUNTS) {
      const s = sessions.get(a.role)!;
      const r = await request(app)
        .post('/api/employees')
        .set('Authorization', `Bearer ${s.token}`)
        .send({});
      if (a.role === 'dir') {
        expect(r.status).toBe(400);
        expect(r.body.code).toBe('VALIDATION_FAILED');
      } else {
        expect(r.status, `${a.role} не смее да создава вработен`).toBe(403);
        expect(r.body.code).toBe('FORBIDDEN_ROLE');
      }
    }
  });

  it('POST /api/holidays: само Директор поминува ролната порта', async () => {
    for (const a of ACCOUNTS) {
      const s = sessions.get(a.role)!;
      const r = await request(app)
        .post('/api/holidays')
        .set('Authorization', `Bearer ${s.token}`)
        .send({});
      if (a.role === 'dir') {
        expect(r.status).toBe(400);
        expect(r.body.code).toBe('VALIDATION_FAILED');
      } else {
        expect(r.status, `${a.role} не смее да создава празник`).toBe(403);
        expect(r.body.code).toBe('FORBIDDEN_ROLE');
      }
    }
  });

  it('GET /api/overview: само улоги со екран „director" во nav (defense in depth)', async () => {
    for (const a of ACCOUNTS) {
      const s = sessions.get(a.role)!;
      const r = await request(app).get('/api/overview').set('Authorization', `Bearer ${s.token}`);
      if (PERMISSIONS[a.role].nav.includes('director')) {
        expect(r.status, `${a.role} треба да гледа преглед`).toBe(200);
      } else {
        expect(r.status, `${a.role} не смее да гледа преглед`).toBe(403);
        expect(r.body.code).toBe('FORBIDDEN_ROLE');
      }
    }
  });

  it('GET /api/automation-rules + /api/automation-runs: само екран „admin" (само Директор)', async () => {
    for (const path of ['/api/automation-rules', '/api/automation-runs']) {
      for (const a of ACCOUNTS) {
        const s = sessions.get(a.role)!;
        const r = await request(app).get(path).set('Authorization', `Bearer ${s.token}`);
        if (PERMISSIONS[a.role].nav.includes('admin')) {
          expect(r.status, `${a.role} → ${path}`).toBe(200);
        } else {
          expect(r.status, `${a.role} не смее да чита ${path}`).toBe(403);
          expect(r.body.code).toBe('FORBIDDEN_ROLE');
        }
      }
    }
  });

  it('неавтентициран пристап до заштитени рути → 401', async () => {
    for (const path of ['/api/me', '/api/tasks', '/api/clients']) {
      const r = await request(app).get(path);
      expect(r.status, `${path} без токен`).toBe(401);
    }
  });
});
