import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { setMetaClient } from '../services/meta/metaClient.js';
import { StubMetaClient } from '../services/meta/metaClient.stub.js';
import { syncConnections, syncStructureForClient } from '../services/meta/sync.js';
import {
  purgeOldMessageBodies,
  syncCommentsForClient,
  syncConversationsForClient,
} from '../services/meta/inbox.js';

/** Модул 3 · Мета — М4a: inbox/comments sync + retention (stub). */
const db = new PrismaClient();
const NAME = 'ТЕСТ Meta Inbox';
let clientId = '';

async function cleanup() {
  const clients = await db.client.findMany({ where: { name: NAME } });
  for (const c of clients) {
    const convos = await db.metaConversation.findMany({ where: { clientId: c.id } });
    for (const cv of convos) await db.metaMessage.deleteMany({ where: { conversationId: cv.id } });
    await db.metaConversation.deleteMany({ where: { clientId: c.id } });
    await db.metaComment.deleteMany({ where: { clientId: c.id } });
    await db.metaConnection.deleteMany({ where: { clientId: c.id } });
    await db.client.delete({ where: { id: c.id } });
  }
}

beforeAll(async () => {
  setMetaClient(new StubMetaClient());
  await cleanup();
  const c = await db.client.create({
    data: {
      name: NAME,
      color: '#0866FF',
      contractStart: new Date(Date.UTC(2035, 0, 1)),
      contractMonths: 12,
      usesMetaAds: true,
      metaAdAccountId: 'act_stub_1',
      metaPageId: 'page_stub_1',
      metaIgId: 'ig_stub_1',
    },
  });
  clientId = c.id;
  await syncConnections();
  await syncStructureForClient(clientId);
});

afterAll(async () => {
  await cleanup();
  setMetaClient(null);
  await db.$disconnect();
});

describe('Meta inbox sync (М4a)', () => {
  it('syncConversations полни разговори (messenger+ig) + пораки', async () => {
    const r = await syncConversationsForClient(clientId);
    expect(r.conversations).toBe(2); // page + ig
    expect(r.messages).toBeGreaterThan(0);
    const convos = await db.metaConversation.findMany({ where: { clientId } });
    expect(convos.some((c) => c.channel === 'messenger')).toBe(true);
    expect(convos.some((c) => c.channel === 'instagram')).toBe(true);
    const msgs = await db.metaMessage.findMany({ where: { conversation: { clientId } } });
    expect(msgs.some((m) => m.fromPage)).toBe(true);
  });

  it('syncComments полни коментари + означува прашања', async () => {
    const r = await syncCommentsForClient(clientId);
    expect(r.comments).toBeGreaterThan(0);
    const comments = await db.metaComment.findMany({ where: { clientId } });
    expect(comments.some((c) => c.isQuestion)).toBe(true); // „Колку чини?"
    expect(comments.some((c) => c.parentObjectType === 'ad')).toBe(true);
  });

  it('retention брише тело на стари пораки, бројки остануваат', async () => {
    // Постави стара порака (пред 13 месеци)
    const conv = await db.metaConversation.findFirst({ where: { clientId } });
    const old = new Date();
    old.setUTCMonth(old.getUTCMonth() - 13);
    await db.metaMessage.create({
      data: {
        conversationId: conv!.id,
        metaMessageId: `old_${clientId}`,
        text: 'стара тајна порака',
        sentAt: old,
      },
    });
    const r = await purgeOldMessageBodies();
    expect(r.purged).toBeGreaterThan(0);
    const purged = await db.metaMessage.findUnique({ where: { metaMessageId: `old_${clientId}` } });
    expect(purged?.text).toBeNull();
    expect(purged?.bodyPurgedAt).toBeTruthy();
  });
});
