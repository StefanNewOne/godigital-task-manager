import { Router } from 'express';
import type { Request, Router as ExpressRouter } from 'express';
import { clientApprovalSchema, magicLinkConsumeSchema, magicLinkRequestSchema } from '@gd/core';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { requireClient } from '../middleware/auth.js';
import { consumeMagicLink, requestMagicLink } from '../services/clientAuth/magicLink.js';
import {
  decideClientApproval,
  getClientApproval,
  listClientApprovals,
  type ClientSession,
} from '../services/clientAuth/approvals.js';

/** Клиентски PWA рути (Фаза D) — ОДДЕЛЕН realm од вработените (види middleware `requireClient`). */
export const clientRouter: ExpressRouter = Router();

const clientCookie = { httpOnly: true, sameSite: 'lax', path: '/' } as const;

function session(req: Request): ClientSession {
  return { contactId: req.clientAuth!.sub, clientId: req.clientAuth!.clientId };
}

// ── Auth (UNAUTHENTICATED) ──

// Барање magic-link — секогаш генерички 200 (без user-enumeration, §9).
clientRouter.post('/auth/magic-link', async (req, res) => {
  const { email } = parse(magicLinkRequestSchema, req.body);
  await requestMagicLink(email);
  res.json({ data: { ok: true } });
});

// Трошење на токен → издава кратка клиентска сесија (JWT realm=client, httpOnly cookie).
clientRouter.post('/auth/consume', async (req, res) => {
  const { token } = parse(magicLinkConsumeSchema, req.body);
  const accessToken = await consumeMagicLink(token);
  if (!accessToken)
    throw new AppError('MAGIC_LINK_INVALID', 'Линкот е неважечки или истечен.', 400);
  res.cookie('client_token', accessToken, clientCookie).json({ data: { accessToken } });
});

clientRouter.post('/auth/logout', (_req, res) => {
  res.clearCookie('client_token', clientCookie).json({ data: { ok: true } });
});

// ── Approvals (client realm) ──

clientRouter.get('/approvals', requireClient, async (req, res) => {
  const data = await listClientApprovals(session(req));
  res.json({ data });
});

clientRouter.get('/approvals/:kind/:id', requireClient, async (req, res) => {
  const { kind, id } = req.params as { kind: string; id: string };
  const data = await getClientApproval(session(req), kind, id);
  res.json({ data });
});

clientRouter.post('/approvals/:kind/:id/decide', requireClient, async (req, res) => {
  const { kind, id } = req.params as { kind: string; id: string };
  const input = parse(clientApprovalSchema, req.body);
  const data = await decideClientApproval(session(req), kind, id, input);
  res.json({ data });
});
