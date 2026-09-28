import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { prisma } from '../db/tenantExtension.js';
import { getMetaClient } from '../services/meta/metaClient.js';
import {
  backfillClientCampaigns,
  backfillClientMedia,
  backfillClientPage,
  pullMetrics,
} from '../services/meta/metrics.js';

/** Meta интеграција (B2). Mounted at /meta. Само dir/am. Токенот е само на backend. */
export const metaRouter: ExpressRouter = Router();

metaRouter.use(requireAuth);

// Достапни страници + IG business сметки (за доделба по клиент во Админ).
metaRouter.get('/accounts', requireRole('dir', 'am'), async (_req, res) => {
  const accounts = await getMetaClient().listAccounts();
  res.json({ data: accounts });
});

// Достапни рекламни сметки (за доделба metaAdAccountId по клиент).
metaRouter.get('/ad-accounts', requireRole('dir', 'am'), async (_req, res) => {
  const accounts = await getMetaClient().listAdAccounts();
  res.json({ data: accounts });
});

// Backfill: IG органски постови + платени кампањи + FB page метрики + повлечи метрики.
metaRouter.post('/clients/:id/backfill', requireRole('dir', 'am'), async (req, res) => {
  const clientId = (req.params as { id: string }).id;
  const limit = Math.min(Number((req.body as { limit?: number })?.limit) || 25, 100);
  const media = await backfillClientMedia(clientId, limit);
  const campaigns = await backfillClientCampaigns(clientId, 50);
  const page = await backfillClientPage(clientId);
  // mediaOnly: кампањите веќе се снимени погоре — избегни дупли snapshots.
  const pulled = await pullMetrics({ mediaOnly: true });
  res.json({ data: { media, campaigns, page, pulled } });
});

// Најнов FB page snapshot за клиент (followers, ангажман, page views…).
metaRouter.get('/clients/:id/page', async (req, res) => {
  const clientId = (req.params as { id: string }).id;
  const snap = await prisma.pageSnapshot.findFirst({
    where: { clientId },
    orderBy: { capturedAt: 'desc' },
  });
  res.json({ data: snap });
});

// Најнови FB page snapshots за сите клиенти (за Аналитика → FB страници).
metaRouter.get('/page-snapshots', requireRole('dir', 'am'), async (_req, res) => {
  const snaps = await prisma.pageSnapshot.findMany({
    orderBy: { capturedAt: 'desc' },
    distinct: ['clientId'],
    include: { client: { select: { name: true, color: true } } },
  });
  res.json({ data: snaps });
});
