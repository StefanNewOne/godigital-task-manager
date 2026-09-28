import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { approveMonthForAllStandard, getMonthProposal } from '../services/monthlyCalendar.js';

/** Месечно одобрување на календар (редизајн). Mounted at /calendar. */
export const monthlyCalendarRouter: ExpressRouter = Router();

monthlyCalendarRouter.use(requireAuth);

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}
const monthOf = (raw: unknown): string =>
  typeof raw === 'string' && /^\d{4}-\d{2}$/.test(raw) ? raw : currentMonth();

// Предлог за месец (групиран по комбинација) + „одобрено?" флаг.
monthlyCalendarRouter.get('/month-proposal', requireRole('dir', 'am'), async (req, res) => {
  const data = await getMonthProposal(monthOf(req.query.month));
  res.json({ data });
});

// Одобри месец за сите стандардни клиенти (со опционални изменети датуми по комбинација).
monthlyCalendarRouter.post('/approve-month', requireRole('dir', 'am'), async (req, res) => {
  const body = req.body as {
    month?: string;
    edits?: Record<string, { videoDates: string[]; graphicDates: string[] }>;
  };
  const result = await approveMonthForAllStandard(
    monthOf(body.month),
    { id: req.auth!.sub, role: req.auth!.role },
    body.edits,
  );
  res.json({ data: result });
});
