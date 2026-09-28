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

function monthOf(raw: unknown, fallback: string): string {
  return typeof raw === 'string' && /^\d{4}-\d{2}$/.test(raw) ? raw : fallback;
}
/** Период од query: `from`/`to` (или назад-компатибилно `month`). */
function periodOf(query: Record<string, unknown>): { from: string; to: string } {
  const legacy = monthOf(query.month, currentMonth());
  const from = monthOf(query.from, legacy);
  const to = monthOf(query.to, from);
  return from <= to ? { from, to } : { from: to, to: from };
}

reportsRouter.get('/clients', async (req, res) => {
  requireReportAccess(req.auth!.role);
  const { from, to } = periodOf(req.query as Record<string, unknown>);
  const rows = await getClientReport(from, to);
  res.json({ data: { from, to, rows } });
});

reportsRouter.get('/clients.csv', async (req, res) => {
  requireReportAccess(req.auth!.role);
  const { from, to } = periodOf(req.query as Record<string, unknown>);
  const rows = await getClientReport(from, to);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="izvestaj-${from}_${to}.csv"`);
  res.send(clientReportToCsv(rows));
});
