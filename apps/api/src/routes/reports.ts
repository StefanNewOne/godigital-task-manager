import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { AppError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { clientReportToCsv, getClientReport } from '../services/reports.js';

export const reportsRouter: ExpressRouter = Router();
reportsRouter.use(requireAuth);

/** Извештаите ги гледаат Директор / Акаунт менаџер / Аналитичар. */
function requireReportAccess(role: string): void {
  if (role !== 'dir' && role !== 'am' && role !== 'ana') {
    throw new AppError('FORBIDDEN_ROLE', 'Нема пристап до извештаи.', 403);
  }
}

function currentMonth(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthOf(raw: unknown): string {
  return typeof raw === 'string' && /^\d{4}-\d{2}$/.test(raw) ? raw : currentMonth();
}

reportsRouter.get('/clients', async (req, res) => {
  requireReportAccess(req.auth!.role);
  const month = monthOf(req.query.month);
  const rows = await getClientReport(month);
  res.json({ data: { month, rows } });
});

reportsRouter.get('/clients.csv', async (req, res) => {
  requireReportAccess(req.auth!.role);
  const month = monthOf(req.query.month);
  const rows = await getClientReport(month);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="izvestaj-${month}.csv"`);
  res.send(clientReportToCsv(rows));
});
