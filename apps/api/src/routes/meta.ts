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
import {
  listMetaAlerts,
  metaClientStructure,
  metaClientsRows,
  metaCross,
  metaOverview,
  setAlertState,
} from '../services/meta/read.js';
import { AppError } from '../lib/errors.js';

/** Meta интеграција (B2 + Модул 3). Mounted at /meta. Токенот е само на backend. */
export const metaRouter: ExpressRouter = Router();

metaRouter.use(requireAuth);

// Модул 3 · Мета — read екрани (Утрински преглед, Клиенти, Пресек, Клиент·Реклами): само dir/ana.
metaRouter.get('/overview', requireRole('dir', 'ana'), async (_req, res) => {
  res.json({ data: await metaOverview() });
});

metaRouter.get('/alerts', requireRole('dir', 'ana'), async (req, res) => {
  const { state, severity, clientId } = req.query as Record<string, string | undefined>;
  res.json({ data: await listMetaAlerts({ state, severity, clientId }) });
});

metaRouter.patch('/alerts/:id', requireRole('dir', 'ana'), async (req, res) => {
  const body = req.body as { state?: string; snoozedUntil?: string };
  if (!body.state) throw new AppError('VALIDATION_FAILED', 'Состојбата е задолжителна.', 400);
  const alert = await setAlertState(
    (req.params as { id: string }).id,
    body.state as never,
    body.snoozedUntil ? new Date(body.snoozedUntil) : null,
  );
  res.json({ data: alert });
});

metaRouter.get('/clients', requireRole('dir', 'ana'), async (_req, res) => {
  res.json({ data: await metaClientsRows() });
});

metaRouter.get('/cross', requireRole('dir', 'ana'), async (req, res) => {
  const period = (req.query.period as string) ?? '7';
  res.json({ data: await metaCross(period) });
});

metaRouter.get('/clients/:id/structure', requireRole('dir', 'ana'), async (req, res) => {
  const period = (req.query.period as string) ?? '7';
  res.json({ data: await metaClientStructure((req.params as { id: string }).id, period) });
});

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
