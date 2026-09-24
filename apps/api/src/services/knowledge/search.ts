import { Prisma } from '@gd/db';
import { ctx } from '../../db/context.js';
import { prisma } from '../../db/tenantExtension.js';
import { getEmbeddingProvider, toVectorLiteral } from './embedding.js';

export interface SearchHit {
  id: string;
  sourceType: string;
  sourceId: string;
  clientId: string | null;
  taskId: string | null;
  groupId: string | null;
  text: string;
  score: number;
}

export interface SearchOptions {
  clientId?: string;
  limit?: number;
}

const CANDIDATES = 20; // по потстрана (вектор / FTS) пред спојување
const RRF_K = 60; // константа за reciprocal rank fusion

/**
 * Хибридно пребарување (PRD §4, B4): pgvector KNN (cosine) + full-text (tsv) споени со RRF.
 * ACL: `tenantId` предикат во raw SQL (И1) + опционен client scope (клиент + глобални порции).
 */
export async function searchKnowledge(
  query: string,
  opts: SearchOptions = {},
): Promise<SearchHit[]> {
  const q = query.trim();
  if (!q) return [];
  const limit = Math.min(opts.limit ?? 8, CANDIDATES);
  const { tenantId } = ctx();
  const vectors = await getEmbeddingProvider().embed([q]);
  const lit = toVectorLiteral(vectors[0]!);

  const clientFilter = opts.clientId
    ? Prisma.sql`AND ("clientId" = ${opts.clientId}::uuid OR "clientId" IS NULL)`
    : Prisma.empty;

  const vecRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id::text AS id FROM "KnowledgeChunk"
    WHERE "tenantId" = ${tenantId} AND embedding IS NOT NULL ${clientFilter}
    ORDER BY embedding <=> ${lit}::vector
    LIMIT ${CANDIDATES}`);

  const ftsRows = await prisma.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id::text AS id FROM "KnowledgeChunk"
    WHERE "tenantId" = ${tenantId} AND tsv @@ plainto_tsquery('simple', ${q}) ${clientFilter}
    ORDER BY ts_rank(tsv, plainto_tsquery('simple', ${q})) DESC
    LIMIT ${CANDIDATES}`);

  const scores = new Map<string, number>();
  const fuse = (rows: Array<{ id: string }>) =>
    rows.forEach((r, i) => scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (RRF_K + i + 1)));
  fuse(vecRows);
  fuse(ftsRows);

  const topIds = [...scores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
  if (topIds.length === 0) return [];

  const chunks = await prisma.knowledgeChunk.findMany({
    where: { id: { in: topIds } },
    select: {
      id: true,
      sourceType: true,
      sourceId: true,
      clientId: true,
      taskId: true,
      groupId: true,
      text: true,
    },
  });
  const byId = new Map(chunks.map((c) => [c.id, c]));
  return topIds
    .map((id) => {
      const c = byId.get(id);
      return c ? { ...c, score: scores.get(id)! } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
}
