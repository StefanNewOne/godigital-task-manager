import type { MetaCommentParent, MetaConvChannel } from '@gd/db';
import { prisma } from '../../db/tenantExtension.js';
import { getMetaClient } from './metaClient.js';

/**
 * Модул 3 · Мета — синхронизација на Инбокс (пораки) + Коментари (§4.5, §7). Само читање; никогаш
 * не праќа/не брише во Meta (D1). Телото на пораките се брише по 12 месеци (retention, §15).
 */

async function metaClients() {
  return prisma.client.findMany({
    where: { usesMetaAds: true, archivedAt: null },
  });
}

function isQuestion(text: string | null): boolean {
  return !!text && text.includes('?');
}

/** Sync на разговори + пораки за еден клиент (Messenger + Instagram). */
export async function syncConversationsForClient(clientId: string) {
  const meta = getMetaClient();
  const conns = await prisma.metaConnection.findMany({
    where: { clientId, kind: { in: ['page', 'igAccount'] } },
  });
  let convCount = 0;
  let msgCount = 0;

  for (const conn of conns) {
    const channel: MetaConvChannel = conn.kind === 'igAccount' ? 'instagram' : 'messenger';
    const convos =
      conn.kind === 'igAccount'
        ? await meta.fetchIgConversations(conn.metaId)
        : await meta.fetchPageConversations(conn.metaId);

    for (const c of convos) {
      const conv = await prisma.metaConversation.upsert({
        where: { metaThreadId: c.threadId },
        create: {
          clientId,
          connectionId: conn.id,
          metaThreadId: c.threadId,
          channel,
          participantName: c.participantName,
          sourceAdMetaId: c.sourceAdMetaId,
          lastMessageAt: c.lastMessageAt ? new Date(c.lastMessageAt) : null,
          unread: c.unread,
          waitingSince: c.unread ? new Date() : null,
        },
        update: {
          participantName: c.participantName,
          lastMessageAt: c.lastMessageAt ? new Date(c.lastMessageAt) : null,
          unread: c.unread,
        },
      });
      convCount++;

      const messages = await meta.fetchConversationMessages(c.threadId);
      for (const m of messages) {
        await prisma.metaMessage.upsert({
          where: { metaMessageId: m.messageId },
          create: {
            conversationId: conv.id,
            metaMessageId: m.messageId,
            fromPage: m.fromPage,
            text: m.text,
            sentAt: m.sentAt ? new Date(m.sentAt) : null,
          },
          update: {},
        });
        msgCount++;
      }
    }
  }
  return { conversations: convCount, messages: msgCount };
}

/** Sync на коментари за еден клиент (на реклами + објавени постови). */
export async function syncCommentsForClient(clientId: string) {
  const meta = getMetaClient();
  let count = 0;

  const targets: Array<{ metaId: string; kind: MetaCommentParent }> = [];
  const ads = await prisma.metaAd.findMany({
    where: { adSet: { campaign: { clientId } } },
    select: { metaId: true },
  });
  for (const ad of ads) targets.push({ metaId: ad.metaId, kind: 'ad' });
  const pubs = await prisma.publication.findMany({
    where: { clientId, metaMediaId: { not: null } },
    select: { id: true, metaMediaId: true },
  });
  const pubByMedia = new Map(pubs.map((p) => [p.metaMediaId!, p.id]));
  for (const p of pubs) targets.push({ metaId: p.metaMediaId!, kind: 'post' });

  for (const t of targets) {
    const comments = await meta.fetchComments(t.metaId);
    for (const c of comments) {
      await prisma.metaComment.upsert({
        where: { metaCommentId: c.commentId },
        create: {
          clientId,
          metaCommentId: c.commentId,
          parentObjectType: t.kind,
          parentMetaId: t.metaId,
          publicationId: t.kind === 'post' ? (pubByMedia.get(t.metaId) ?? null) : null,
          authorName: c.authorName,
          text: c.text,
          createdTime: c.createdTime ? new Date(c.createdTime) : null,
          isQuestion: isQuestion(c.text),
        },
        update: { text: c.text, isQuestion: isQuestion(c.text) },
      });
      count++;
    }
  }
  return { comments: count };
}

/** Оркестратори за cron. */
export async function syncAllInbox() {
  const clients = await metaClients();
  let conversations = 0;
  let comments = 0;
  for (const c of clients) {
    const conv = await syncConversationsForClient(c.id);
    conversations += conv.conversations;
    const com = await syncCommentsForClient(c.id);
    comments += com.comments;
  }
  return { clients: clients.length, conversations, comments };
}

/** Retention (§15): бриши го телото на пораки постари од 12 месеци; бројките остануваат. */
export async function purgeOldMessageBodies() {
  const cutoff = new Date();
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 12);
  const r = await prisma.metaMessage.updateMany({
    where: { sentAt: { lt: cutoff }, bodyPurgedAt: null, text: { not: null } },
    data: { text: null, bodyPurgedAt: new Date() },
  });
  return { purged: r.count };
}
