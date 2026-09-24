import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { env } from '../env.js';

/** Интеграциски тест за B4.1: knowledge backfill + embedding (stub провајдер + pgvector). */
const app = createApp();
const db = new PrismaClient();

const cron = (path: string) =>
  request(app).post(`/api/cron/${path}`).set('x-cron-secret', env.CRON_SECRET).send({});

beforeAll(async () => {
  await db.knowledgeChunk.deleteMany({ where: { sourceType: 'clientProfile' } });
});

describe('B4.1 knowledge indexing', () => {
  it('backfill создава pending порции од постоечките ентитети', async () => {
    const r = await cron('knowledge-backfill');
    expect(r.status).toBe(200);
    expect(r.body.data.created).toBeGreaterThan(0);

    const pending = await db.knowledgeChunk.count({ where: { embeddingStatus: 'pending' } });
    expect(pending).toBeGreaterThan(0);
  });

  it('knowledge-index embed-ира pending порции (вектор + tsv запишани)', async () => {
    const r = await cron('knowledge-index');
    expect(r.status).toBe(200);
    expect(r.body.data.embedded).toBeGreaterThan(0);

    const done = await db.knowledgeChunk.count({ where: { embeddingStatus: 'done' } });
    expect(done).toBeGreaterThan(0);

    const rows = await db.$queryRaw<Array<{ count: number }>>`
      SELECT count(*)::int AS count FROM "KnowledgeChunk"
      WHERE embedding IS NOT NULL AND tsv IS NOT NULL`;
    expect(rows[0]!.count).toBeGreaterThan(0);
  });

  it('повторени knowledge-index ги испразнуваат pending (idempotent embedding)', async () => {
    for (let i = 0; i < 40; i++) {
      const r = await cron('knowledge-index');
      if (r.body.data.embedded === 0) break;
    }
    const pending = await db.knowledgeChunk.count({ where: { embeddingStatus: 'pending' } });
    expect(pending).toBe(0);
  });

  it('без cron токен → 403', async () => {
    const r = await request(app).post('/api/cron/knowledge-index').send({});
    expect(r.status).toBe(403);
  });
});
