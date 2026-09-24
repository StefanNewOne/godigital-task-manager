import { createHash } from 'node:crypto';
import { Prisma, type KnowledgeSource, type Visibility } from '@gd/db';
import { ctx } from '../../db/context.js';
import { prisma } from '../../db/tenantExtension.js';
import { getEmbeddingProvider, toVectorLiteral } from './embedding.js';

export interface KnowledgeInput {
  sourceType: KnowledgeSource;
  sourceId: string;
  clientId?: string | null;
  taskId?: string | null;
  groupId?: string | null;
  visibility?: Visibility;
  occurredAt: Date;
  text: string;
  metadata?: Record<string, unknown>;
}

/**
 * Создади/освежи `KnowledgeChunk` (pending за embedding). Idempotent по (sourceType, sourceId,
 * contentHash): непроменет текст → без работа; променет → старата порција се брише, нова pending.
 */
export async function indexKnowledge(input: KnowledgeInput): Promise<string | null> {
  const text = input.text.trim();
  if (!text) return null;
  const contentHash = createHash('sha256').update(text).digest('hex');

  const existing = await prisma.knowledgeChunk.findUnique({
    where: {
      sourceType_sourceId_contentHash: {
        sourceType: input.sourceType,
        sourceId: input.sourceId,
        contentHash,
      },
    },
    select: { id: true },
  });
  if (existing) return existing.id;

  await prisma.knowledgeChunk.deleteMany({
    where: { sourceType: input.sourceType, sourceId: input.sourceId },
  });
  const chunk = await prisma.knowledgeChunk.create({
    data: {
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      clientId: input.clientId ?? null,
      taskId: input.taskId ?? null,
      groupId: input.groupId ?? null,
      visibility: input.visibility ?? 'internal',
      occurredAt: input.occurredAt,
      text,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      contentHash,
      embeddingStatus: 'pending',
    },
  });
  return chunk.id;
}

/**
 * Embed-ирај ги pending порциите (worker `knowledge.index`). Векторот + `tsv` се пишуваат преку
 * raw SQL (Unsupported колони). Raw SQL носи `tenantId` предикат (И1).
 */
export async function processPendingEmbeddings(limit = 500): Promise<{ embedded: number }> {
  const pending = await prisma.knowledgeChunk.findMany({
    where: { embeddingStatus: 'pending' },
    take: limit,
    select: { id: true, text: true },
  });
  if (pending.length === 0) return { embedded: 0 };

  const provider = getEmbeddingProvider();
  const vectors = await provider.embed(pending.map((c) => c.text));
  const { tenantId } = ctx();
  let embedded = 0;
  for (let i = 0; i < pending.length; i++) {
    const c = pending[i]!;
    const lit = toVectorLiteral(vectors[i]!);
    await prisma.$executeRaw`
      UPDATE "KnowledgeChunk"
      SET embedding = ${lit}::vector,
          tsv = to_tsvector('simple', ${c.text}),
          "embeddingStatus" = 'done',
          "embeddingModel" = ${provider.model}
      WHERE id = ${c.id}::uuid AND "tenantId" = ${tenantId}`;
    embedded++;
  }
  return { embedded };
}

/**
 * Backfill на знаењето од постоечките ентитети (еднократно/периодично): профили на клиенти,
 * коментари и наративи на настани. Создава pending порции; embedding-от го прави `knowledge.index`.
 */
export async function backfillKnowledge(): Promise<{ created: number }> {
  let created = 0;
  const bump = async (id: string | null) => {
    if (id) created++;
  };

  const clients = await prisma.client.findMany({
    where: { archivedAt: null },
    select: { id: true, name: true, notes: true, updatedAt: true },
  });
  for (const c of clients) {
    const text = [c.name, c.notes].filter(Boolean).join('\n');
    await bump(
      await indexKnowledge({
        sourceType: 'clientProfile',
        sourceId: c.id,
        clientId: c.id,
        occurredAt: c.updatedAt,
        text,
        metadata: { name: c.name },
      }),
    );
  }

  const comments = await prisma.comment.findMany({
    where: { kind: 'comment' },
    select: { id: true, body: true, taskId: true, groupId: true, createdAt: true },
    take: 2000,
    orderBy: { createdAt: 'desc' },
  });
  const taskClient = await taskClientMap(comments.map((x) => x.taskId).filter(Boolean) as string[]);
  for (const cm of comments) {
    await bump(
      await indexKnowledge({
        sourceType: 'comment',
        sourceId: cm.id,
        taskId: cm.taskId,
        groupId: cm.groupId,
        clientId: cm.taskId ? (taskClient.get(cm.taskId) ?? null) : null,
        occurredAt: cm.createdAt,
        text: cm.body,
      }),
    );
  }

  const events = await prisma.eventLog.findMany({
    select: {
      id: true,
      narrative: true,
      clientId: true,
      taskId: true,
      groupId: true,
      occurredAt: true,
    },
    take: 2000,
    orderBy: { occurredAt: 'desc' },
  });
  for (const e of events) {
    await bump(
      await indexKnowledge({
        sourceType: 'eventNarrative',
        sourceId: e.id,
        clientId: e.clientId,
        taskId: e.taskId,
        groupId: e.groupId,
        occurredAt: e.occurredAt,
        text: e.narrative,
      }),
    );
  }

  return { created };
}

async function taskClientMap(taskIds: string[]): Promise<Map<string, string>> {
  if (taskIds.length === 0) return new Map();
  const tasks = await prisma.task.findMany({
    where: { id: { in: taskIds } },
    select: { id: true, clientId: true },
  });
  return new Map(tasks.map((t) => [t.id, t.clientId]));
}
