import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth, requireScreen } from '../middleware/auth.js';
import { getAnalytics } from '../services/analytics.js';

export const analyticsRouter: ExpressRouter = Router();
// Аналитика е достапна само за улоги што го носат екранот „analytics" во nav.
analyticsRouter.use(requireAuth, requireScreen('analytics'));

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

analyticsRouter.get('/', async (req, res) => {
  const raw = req.query.month;
  const month = typeof raw === 'string' && /^\d{4}-\d{2}$/.test(raw) ? raw : currentMonth();
  const data = await getAnalytics(month);
  res.json({ data });
});
