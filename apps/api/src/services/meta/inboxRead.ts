import type { Prisma } from '@gd/db';
import { prisma } from '../../db/tenantExtension.js';
import { AppError } from '../../lib/errors.js';
import { recordEvent } from '../../lib/events.js';
import { periodRange } from './read.js';

/**
 * Модул 3 · Мета — read за Инбокс + Коментари (§8). Достапно за dir/ana/am. Секое отворање на
 * разговор се логира (приватност, §15). Само читање; никогаш не праќа во Meta.
 */

/**
 * Резиме на пораките (§8 „Резиме на пораките") — теми, од кои реклами доаѓаат, колку чекаат.
 * Составено од податоците (без проценки). Опционен клиент + период по `lastMessageAt`.
 */
export async function conversationsSummary(opts: { clientId?: string; period?: string }) {
  const where: Prisma.MetaConversationWhereInput = {};
  if (opts.clientId) where.clientId = opts.clientId;
  if (opts.period) {
    const { from, to } = periodRange(opts.period);
    where.lastMessageAt = { gte: from, lte: to };
  }
  const convos = await prisma.metaConversation.findMany({
    where,
    select: { topic: true, sourceAdMetaId: true, waitingSince: true, unread: true },
    take: 1000,
  });

  const topicMap = new Map<string, number>();
  const adMap = new Map<string, number>();
  let waiting = 0;
  for (const c of convos) {
    const topic = c.topic ?? 'друго';
    topicMap.set(topic, (topicMap.get(topic) ?? 0) + 1);
    if (c.sourceAdMetaId) adMap.set(c.sourceAdMetaId, (adMap.get(c.sourceAdMetaId) ?? 0) + 1);
    if (c.waitingSince) waiting += 1;
  }
  const sortDesc = (m: Map<string, number>) =>
    [...m.entries()].map(([k, count]) => ({ key: k, count })).sort((a, b) => b.count - a.count);

  return {
    total: convos.length,
    unread: convos.filter((c) => c.unread).length,
    waiting,
    topics: sortDesc(topicMap).slice(0, 8),
    fromAds: sortDesc(adMap).slice(0, 8),
  };
}

/** Листа разговори (со филтри). */
export async function listConversations(opts: { clientId?: string; unread?: boolean }) {
  const where: Prisma.MetaConversationWhereInput = {};
  if (opts.clientId) where.clientId = opts.clientId;
  if (opts.unread) where.unread = true;
  return prisma.metaConversation.findMany({
    where,
    orderBy: [{ lastMessageAt: 'desc' }],
    take: 200,
  });
}

/** Отвори разговор — логира отворање (приватност) + враќа пораки. */
export async function getConversation(id: string) {
  const conv = await prisma.metaConversation.findUnique({ where: { id } });
  if (!conv) throw new AppError('NOT_FOUND', 'Разговорот не е пронајден.', 404);
  const messages = await prisma.metaMessage.findMany({
    where: { conversationId: id },
    orderBy: { sentAt: 'asc' },
  });
  await prisma.$transaction(async (tx) => {
    await recordEvent(
      tx,
      {
        eventType: 'meta.conversation.opened',
        objectType: 'meta_conversation',
        objectId: id,
        clientId: conv.clientId,
        narrative: `Отворен разговор со „${conv.participantName ?? 'непознат'}".`,
      },
      ['realtime'],
    );
  });
  return { ...conv, messages };
}

/** Внатрешни ознаки на разговор (обработено/за клиентот/важно). */
export async function setConversationTags(id: string, tags: string[]) {
  const conv = await prisma.metaConversation.findUnique({ where: { id } });
  if (!conv) throw new AppError('NOT_FOUND', 'Разговорот не е пронајден.', 404);
  return prisma.metaConversation.update({ where: { id }, data: { tags } });
}

/** Листа коментари (filter: open|q|ads|bad). */
export async function listComments(opts: { clientId?: string; filter?: string }) {
  const where: Prisma.MetaCommentWhereInput = {};
  if (opts.clientId) where.clientId = opts.clientId;
  if (opts.filter === 'q') where.isQuestion = true;
  if (opts.filter === 'bad') where.isComplaint = true;
  if (opts.filter === 'ads') where.parentObjectType = 'ad';
  if (opts.filter === 'open') where.tags = { isEmpty: true };
  return prisma.metaComment.findMany({
    where,
    orderBy: [{ createdTime: 'desc' }],
    take: 300,
  });
}

export async function setCommentTags(id: string, tags: string[]) {
  const c = await prisma.metaComment.findUnique({ where: { id } });
  if (!c) throw new AppError('NOT_FOUND', 'Коментарот не е пронајден.', 404);
  return prisma.metaComment.update({ where: { id }, data: { tags } });
}
