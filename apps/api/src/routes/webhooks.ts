import crypto from 'node:crypto';
import { Router } from 'express';
import type { Request, Router as ExpressRouter } from 'express';
import { env } from '../env.js';
import { prisma } from '../db/tenantExtension.js';
import { logger } from '../lib/logger.js';
import { syncCommentsForClient, syncConversationsForClient } from '../services/meta/inbox.js';

/**
 * Модул 3 · Мета — webhooks (§7). Meta повикува БЕЗ JWT, па оваа рута е надвор од auth.
 * GET  = verify handshake (hub.challenge). POST = потпис X-Hub-Signature-256, потоа best-effort
 * повлекување (read-only) на разговори/коментари за засегнатите клиенти. Никогаш не пишува во Meta.
 */
export const webhookRouter: ExpressRouter = Router();

interface WebhookChange {
  field?: string;
}
interface WebhookEntry {
  id?: string;
  messaging?: unknown[];
  changes?: WebhookChange[];
}

/** GET verify — Meta го праќа при претплата (subscribe). Врати hub.challenge ако токенот се совпаѓа. */
webhookRouter.get('/meta', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];
  if (mode === 'subscribe' && token === env.META_WEBHOOK_VERIFY_TOKEN) {
    res
      .status(200)
      .type('text/plain')
      .send(String(challenge ?? ''));
    return;
  }
  res.sendStatus(403);
});

/** Провери X-Hub-Signature-256 = sha256=HMAC(META_APP_SECRET, raw body). Без секрет → одбиј. */
function verifySignature(req: Request): boolean {
  if (!env.META_APP_SECRET) return false;
  const header = req.header('x-hub-signature-256');
  if (!header || !header.startsWith('sha256=')) return false;
  const raw = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!raw || raw.length === 0) return false;
  const expected =
    'sha256=' + crypto.createHmac('sha256', env.META_APP_SECRET).update(raw).digest('hex');
  const a = Buffer.from(header);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/** Мапира entry.id (page/ig id) → clientId преку MetaConnection и повлекува само она што се сменило. */
async function handlePayload(body: unknown): Promise<void> {
  const entries = (body as { entry?: WebhookEntry[] })?.entry;
  if (!Array.isArray(entries)) return;
  const wantConversations = new Set<string>();
  const wantComments = new Set<string>();
  for (const entry of entries) {
    if (!entry?.id) continue;
    const conn = await prisma.metaConnection.findFirst({ where: { metaId: entry.id } });
    if (!conn) continue;
    if (Array.isArray(entry.messaging) && entry.messaging.length > 0) {
      wantConversations.add(conn.clientId);
    }
    for (const change of entry.changes ?? []) {
      const field = change?.field ?? '';
      if (field === 'feed' || field === 'comments' || field === 'mentions') {
        wantComments.add(conn.clientId);
      }
      if (field === 'messages' || field === 'message_reactions') {
        wantConversations.add(conn.clientId);
      }
    }
  }
  for (const clientId of wantConversations) {
    await syncConversationsForClient(clientId);
  }
  for (const clientId of wantComments) {
    await syncCommentsForClient(clientId);
  }
}

/** POST webhook — потврди веднаш (200), потоа обработи асинхроно (read-only sync). */
webhookRouter.post('/meta', (req, res) => {
  if (!verifySignature(req)) {
    res.sendStatus(403);
    return;
  }
  res.sendStatus(200);
  void handlePayload(req.body).catch((err) => {
    logger.error({ err }, 'meta webhook: неуспешно повлекување по настан');
  });
});
