import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getMetaClient } from '../services/meta/metaClient.js';
import { backfillClientMedia, pullMetrics } from '../services/meta/metrics.js';

/** Meta интеграција (B2). Mounted at /meta. Само dir/am. Токенот е само на backend. */
export const metaRouter: ExpressRouter = Router();

metaRouter.use(requireAuth);

// Достапни страници + IG business сметки (за доделба по клиент во Админ).
metaRouter.get('/accounts', requireRole('dir', 'am'), async (_req, res) => {
  const accounts = await getMetaClient().listAccounts();
  res.json({ data: accounts });
});

// Backfill на постоечки постови од сметката на клиентот + веднаш повлечи метрики.
metaRouter.post('/clients/:id/backfill', requireRole('dir', 'am'), async (req, res) => {
  const clientId = (req.params as { id: string }).id;
  const limit = Math.min(Number((req.body as { limit?: number })?.limit) || 25, 100);
  const backfill = await backfillClientMedia(clientId, limit);
  const pulled = await pullMetrics();
  res.json({ data: { backfill, pulled } });
});
