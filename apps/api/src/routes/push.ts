import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { pushSubscribeSchema, pushUnsubscribeSchema } from '@gd/core';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { pushPublicKey, subscribePush, unsubscribePush } from '../services/push.js';

/** Web Push претплати по вработен-уред (Фаза C5). */
export const pushRouter: ExpressRouter = Router();
pushRouter.use(requireAuth);

// Јавниот VAPID клуч (frontend го користи за applicationServerKey).
pushRouter.get('/public-key', (_req, res) => {
  res.json({ data: { key: pushPublicKey() } });
});

pushRouter.post('/subscribe', async (req, res) => {
  const input = parse(pushSubscribeSchema, req.body);
  await subscribePush(req.auth!.sub, input);
  res.status(201).json({ data: { ok: true } });
});

pushRouter.post('/unsubscribe', async (req, res) => {
  const { endpoint } = parse(pushUnsubscribeSchema, req.body);
  await unsubscribePush(endpoint);
  res.json({ data: { ok: true } });
});
