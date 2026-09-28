import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth, requireScreen } from '../middleware/auth.js';
import { listShootCalendar } from '../services/shoots.js';

/** Календар на снимање (Режисер/Директор/Камерман). Mounted at /shoot-calendar. */
export const shootCalendarRouter: ExpressRouter = Router();
shootCalendarRouter.use(requireAuth, requireScreen('shootCalendar'));

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

shootCalendarRouter.get('/', async (req, res) => {
  const raw = req.query.month;
  const month = typeof raw === 'string' && /^\d{4}-\d{2}$/.test(raw) ? raw : currentMonth();
  const data = await listShootCalendar(month);
  res.json({ data: { month, shoots: data } });
});
