import { Router } from 'express';
import type { NextFunction, Request, Response, Router as ExpressRouter } from 'express';
import { env } from '../env.js';
import { AppError } from '../lib/errors.js';
import { generateForAllActiveClients, nextMonthKey } from '../services/slots.js';
import { evaluateCoverageAlarms } from '../services/alarms.js';

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
