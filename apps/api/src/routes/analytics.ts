import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth, requireScreen } from '../middleware/auth.js';
import { getAnalytics } from '../services/analytics.js';
import { getClientAnalytics } from '../services/clientAnalytics.js';

export const analyticsRouter: ExpressRouter = Router();
// Аналитика е достапна само за улоги што го носат екранот „analytics" во nav.
analyticsRouter.use(requireAuth, requireScreen('analytics'));

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

const isMonth = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}$/.test(v);

analyticsRouter.get('/', async (req, res) => {
  const raw = req.query.month;
  const month = isMonth(raw) ? raw : currentMonth();
  const data = await getAnalytics(month);
  res.json({ data });
});

// Редизајн: аналитика по КЛИЕНТ + ПЕРИОД (Instagram · Facebook · Реклами, разбивка по месец).
analyticsRouter.get('/client/:id', async (req, res) => {
  const from = isMonth(req.query.from) ? req.query.from : currentMonth();
  const to = isMonth(req.query.to) ? req.query.to : from;
  const data = await getClientAnalytics((req.params as { id: string }).id, from, to);
  res.json({ data });
});
