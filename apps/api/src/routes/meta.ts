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
import {
  getConversation,
  listComments,
  listConversations,
  setCommentTags,
  setConversationTags,
} from '../services/meta/inboxRead.js';
import {
  approvePlan,
  archiveCsv,
  createPlan,
  listArchive,
  listPlans,
  markPlanDone,
  rejectPlan,
  withdrawPlan,
} from '../services/meta/plans.js';
import { metaAssistantChat } from '../services/meta/assistant.js';
import {
  metaClientOrganic,
  metaClientProfile,
  updateMetaClientProfile,
} from '../services/meta/clientDetail.js';
import { metaConnections } from '../services/meta/connections.js';
import {
  syncAllInsightsToday,
  syncAllStructure,
  syncConnections,
  syncInsightsForClient,
  syncStructureForClient,
} from '../services/meta/sync.js';
import {
  syncAllInbox,
  syncCommentsForClient,
  syncConversationsForClient,
} from '../services/meta/inbox.js';
import { logger } from '../lib/logger.js';
import type { OpCode } from '@gd/core';
import { OP_CODES } from '@gd/core';
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

// Мета · Клиент — Профил (цели/прагови/белешки). GET dir/ana; PATCH само dir (§8).
metaRouter.get('/clients/:id/profile', requireRole('dir', 'ana'), async (req, res) => {
  res.json({ data: await metaClientProfile((req.params as { id: string }).id) });
});

metaRouter.patch('/clients/:id/profile', requireRole('dir'), async (req, res) => {
  res.json({
    data: await updateMetaClientProfile(
      (req.params as { id: string }).id,
      (req.body ?? {}) as Parameters<typeof updateMetaClientProfile>[1],
    ),
  });
});

// Мета · Клиент — Органика (IG постови + KPI за периодот).
metaRouter.get('/clients/:id/organic', requireRole('dir', 'ana'), async (req, res) => {
  const period = (req.query.period as string) ?? '7';
  res.json({ data: await metaClientOrganic((req.params as { id: string }).id, period) });
});

// Инбокс + Коментари — достапни и за Акаунт менаџер (§3).
metaRouter.get('/conversations', requireRole('dir', 'ana', 'am'), async (req, res) => {
  const { clientId, unread } = req.query as Record<string, string | undefined>;
  res.json({
    data: await listConversations({ clientId, unread: unread === '1' || unread === 'true' }),
  });
});

metaRouter.get('/conversations/:id', requireRole('dir', 'ana', 'am'), async (req, res) => {
  res.json({ data: await getConversation((req.params as { id: string }).id) });
});

metaRouter.patch('/conversations/:id/tags', requireRole('dir', 'ana', 'am'), async (req, res) => {
  const tags = (req.body as { tags?: string[] }).tags ?? [];
  res.json({ data: await setConversationTags((req.params as { id: string }).id, tags) });
});

metaRouter.get('/comments', requireRole('dir', 'ana', 'am'), async (req, res) => {
  const { clientId, filter } = req.query as Record<string, string | undefined>;
  res.json({ data: await listComments({ clientId, filter }) });
});

metaRouter.patch('/comments/:id/tags', requireRole('dir', 'ana', 'am'), async (req, res) => {
  const tags = (req.body as { tags?: string[] }).tags ?? [];
  res.json({ data: await setCommentTags((req.params as { id: string }).id, tags) });
});

// ─── Планови за промена (§12) — dir/ana; создавање (dir→approved, ana→pending); одобрување само dir ───
metaRouter.get('/plans', requireRole('dir', 'ana'), async (req, res) => {
  const { clientId, status } = req.query as Record<string, string | undefined>;
  res.json({ data: await listPlans({ clientId, status }) });
});

metaRouter.post('/plans', requireRole('dir', 'ana'), async (req, res) => {
  const b = req.body as {
    op?: string;
    clientId?: string;
    target?: Record<string, string>;
    params?: Record<string, unknown>;
    note?: string;
    taskId?: string;
    promotionId?: string;
    via?: 'manual' | 'assistant';
    command?: string;
  };
  if (!b.op || !OP_CODES.includes(b.op as OpCode)) {
    throw new AppError('VALIDATION_FAILED', 'Невалидна операција.', 400);
  }
  if (!b.clientId) throw new AppError('VALIDATION_FAILED', 'Клиентот е задолжителен.', 400);
  const plan = await createPlan({
    op: b.op as OpCode,
    clientId: b.clientId,
    target: b.target ?? {},
    params: b.params,
    note: b.note,
    taskId: b.taskId,
    promotionId: b.promotionId,
    via: b.via,
    command: b.command,
  });
  res.status(201).json({ data: plan });
});

metaRouter.post('/plans/:id/approve', requireRole('dir'), async (req, res) => {
  res.json({ data: await approvePlan((req.params as { id: string }).id) });
});

metaRouter.post('/plans/:id/reject', requireRole('dir'), async (req, res) => {
  const note = ((req.body ?? {}) as { note?: string }).note ?? '';
  res.json({ data: await rejectPlan((req.params as { id: string }).id, note) });
});

metaRouter.post('/plans/:id/mark-done', requireRole('dir'), async (req, res) => {
  res.json({ data: await markPlanDone((req.params as { id: string }).id) });
});

metaRouter.post('/plans/:id/withdraw', requireRole('ana', 'dir'), async (req, res) => {
  res.json({ data: await withdrawPlan((req.params as { id: string }).id) });
});

// „Освежи сега" (§8 топ-бар) — invalidate + закажи sync во позадина (fire-and-forget, не блокира).
// clientId зададен → само тој клиент; инаку сите. Само читање кон Meta (D1).
metaRouter.post('/refresh', requireRole('dir', 'ana'), async (req, res) => {
  const clientId = ((req.body ?? {}) as { clientId?: string }).clientId;
  const today = new Date().toISOString().slice(0, 10);
  const work = clientId
    ? (async () => {
        await syncStructureForClient(clientId);
        await syncInsightsForClient(clientId, today, false);
        await syncConversationsForClient(clientId);
        await syncCommentsForClient(clientId);
      })()
    : (async () => {
        await syncConnections();
        await syncAllStructure();
        await syncAllInsightsToday();
        await syncAllInbox();
      })();
  void work.catch((err) => logger.error({ err }, 'meta refresh: неуспешно освежување'));
  res.status(202).json({ data: { scheduled: true, scope: clientId ?? 'all' } });
});

// AI помошник (§11) — посебен чат. Само чита + подготвува нацрт-план (не создава). dir/ana.
metaRouter.post('/assistant/chat', requireRole('dir', 'ana'), async (req, res) => {
  const b = (req.body ?? {}) as { message?: string; clientId?: string };
  if (!b.message?.trim()) {
    throw new AppError('VALIDATION_FAILED', 'Пораката е задолжителна.', 400);
  }
  const result = await metaAssistantChat({
    message: b.message,
    clientId: b.clientId,
    actorRole: req.auth!.role,
  });
  res.json({ data: result });
});

// Архива = EventLog meta.* (append-only). CSV извоз за Директор.
metaRouter.get('/archive', requireRole('dir', 'ana'), async (req, res) => {
  const { clientId, from, to } = req.query as Record<string, string | undefined>;
  res.json({ data: await listArchive({ clientId, from, to }) });
});

metaRouter.get('/archive.csv', requireRole('dir'), async (req, res) => {
  const { clientId, from, to } = req.query as Record<string, string | undefined>;
  const csv = await archiveCsv({ clientId, from, to });
  res
    .type('text/csv')
    .header('Content-Disposition', 'attachment; filename="meta-arhiva.csv"')
    .send(csv);
});

// Поврзувања (§8, MF3) — токен-статус (без вредности, §12) + конекции по клиент. dir/ana.
metaRouter.get('/connections', requireRole('dir', 'ana'), async (_req, res) => {
  res.json({ data: await metaConnections() });
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
