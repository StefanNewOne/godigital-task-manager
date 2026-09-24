import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { createApp } from '../app.js';
import { env } from '../env.js';

/** Интеграциски тест за B4.1/B4.2: knowledge backfill + embedding + хибридно пребарување. */
const app = createApp();
const db = new PrismaClient();
let dirToken = '';
const UNIQUE = 'ЗЕБРАТЕСТ123';

const cron = (path: string) =>
  request(app).post(`/api/cron/${path}`).set('x-cron-secret', env.CRON_SECRET).send({});

beforeAll(async () => {
  const login = await request(app)
    .post('/api/auth/login')
    .send({ email: 'aleks@godigital.mk', password: 'gd-devpass-2026' });
  dirToken = login.body.data.accessToken as string;
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

  it('хибридно пребарување ја наоѓа уникатната порција (B4.2)', async () => {
    await db.knowledgeChunk.create({
      data: {
        sourceType: 'processDoc',
        sourceId: randomUUID(),
        visibility: 'internal',
        occurredAt: new Date('2027-01-01'),
        text: `${UNIQUE} уникатен документ за правила на враќање`,
        metadata: {},
        contentHash: randomUUID(),
        embeddingStatus: 'pending',
      },
    });
    await cron('knowledge-index');

    const r = await request(app)
      .post('/api/knowledge/search')
      .set({ Authorization: `Bearer ${dirToken}` })
      .send({ query: UNIQUE });
    expect(r.status).toBe(200);
    const hits = r.body.data as Array<{ text: string; score: number }>;
    expect(hits.length).toBeGreaterThan(0);
    // Единствената tsv-погодена порција е меѓу врвните резултати (RRF со FTS + вектор).
    expect(hits.some((h) => h.text.includes(UNIQUE))).toBe(true);
  });

  it('празно прашање → 400', async () => {
    const r = await request(app)
      .post('/api/knowledge/search')
      .set({ Authorization: `Bearer ${dirToken}` })
      .send({ query: '' });
    expect(r.status).toBe(400);
  });
});
