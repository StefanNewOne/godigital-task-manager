import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getOverview } from '../services/overview.js';

export const overviewRouter: ExpressRouter = Router();
overviewRouter.use(requireAuth);

overviewRouter.get('/', async (_req, res) => {
  const data = await getOverview();
  res.json({ data });
});
