import { Router } from 'express';
import type { NextFunction, Request, Response, Router as ExpressRouter } from 'express';
import { env } from '../env.js';
import { AppError } from '../lib/errors.js';
import { generateForAllActiveClients, nextMonthKey } from '../services/slots.js';
import { remindMonthlyPlan } from '../services/monthlyPlan.js';
import { evaluateCoverageAlarms } from '../services/alarms.js';
import { generateDailyDigest } from '../services/digest.js';
import { pullMetrics, resolvePublications } from '../services/meta/metrics.js';
import { evaluateStorageQuota, runStorageCleanup } from '../services/storage.js';
import { backfillKnowledge, processPendingEmbeddings } from '../services/knowledge/index.js';

/** Cron рути — заштитени со CRON_SECRET (не JWT). Ги повикува worker-от. */
export const cronRouter: ExpressRouter = Router();

function requireCronSecret(req: Request, _res: Response, next: NextFunction): void {
  const provided = req.header('x-cron-secret') ?? req.query.secret;
  if (provided !== env.CRON_SECRET) {
    next(new AppError('FORBIDDEN_ROLE', 'Невалиден cron токен.', 403));
    return;
  }
  next();
}

// Генерирање на месечни слотови (по default за следниот месец). BullMQ job: 0 6 20 * *.
cronRouter.post('/slots-generate', requireCronSecret, async (req, res) => {
  const month =
    typeof (req.body as { month?: string })?.month === 'string'
      ? (req.body as { month: string }).month
      : nextMonthKey();
  const result = await generateForAllActiveClients(month);
  res.json({ data: result });
});

// Евалуација на аларми за покриеност (PRD §4.13). BullMQ: дневно.
cronRouter.post('/evaluate-alarms', requireCronSecret, async (_req, res) => {
  const result = await evaluateCoverageAlarms();
  res.json({ data: result });
});

// Дневен преглед за Директор (PRD §4.13). BullMQ job notifications.digest: 0 7 * * *.
cronRouter.post('/notifications-digest', requireCronSecret, async (_req, res) => {
  const result = await generateDailyDigest();
  res.json({ data: result });
});

// Meta метрики (PRD §4.7/§4.8, B2): резолвирај media id, па влечи insights → MetricSnapshot.
// BullMQ job metrics.pull: 0 */6 * * *.
cronRouter.post('/metrics-pull', requireCronSecret, async (_req, res) => {
  const resolved = await resolvePublications();
  const pulled = await pullMetrics();
  res.json({ data: { ...resolved, ...pulled } });
});

// Сторидж cleanup (PRD §4, B3): бриши истечен суров материјал. BullMQ: дневно.
cronRouter.post('/storage-cleanup', requireCronSecret, async (_req, res) => {
  const result = await runStorageCleanup();
  res.json({ data: result });
});

// Квота аларм (B3): вкупен сторидж наспроти прагот → критично до Директор. BullMQ: дневно.
cronRouter.post('/storage-quota', requireCronSecret, async (_req, res) => {
  const result = await evaluateStorageQuota();
  res.json({ data: result });
});

// Знаење (B4): embed-ирај pending порции. BullMQ: често (пр. на 2 мин / по Outbox).
cronRouter.post('/knowledge-index', requireCronSecret, async (_req, res) => {
  const result = await processPendingEmbeddings();
  res.json({ data: result });
});

// Знаење backfill (B4): индексирај ги постоечките ентитети (еднократно/периодично).
cronRouter.post('/knowledge-backfill', requireCronSecret, async (_req, res) => {
  const result = await backfillKnowledge();
  res.json({ data: result });
});

// Месечен план потсетник/аларм: до 15-ти тивко, на 15-ти потсетник, по 15-ти аларм. BullMQ: дневно.
cronRouter.post('/monthly-plan-reminder', requireCronSecret, async (_req, res) => {
  const result = await remindMonthlyPlan();
  res.json({ data: result });
});
