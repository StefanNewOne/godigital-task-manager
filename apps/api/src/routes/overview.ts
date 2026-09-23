import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getOverview } from '../services/overview.js';

export const overviewRouter: ExpressRouter = Router();
overviewRouter.use(requireAuth);

overviewRouter.get('/', async (req, res) => {
  const raw = req.query.month;
  const month = typeof raw === 'string' && /^\d{4}-\d{2}$/.test(raw) ? raw : undefined;
  const data = await getOverview(month);
  res.json({ data });
});
