import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { monthlyPlanPutSchema } from '@gd/core';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { AppError } from '../lib/errors.js';
import { confirmMonthlyPlan, getMonthlyPlan, putMonthlyPlan } from '../services/monthlyPlan.js';
import { generateForApprovedClients } from '../services/slots.js';

/** Месечен план на клиенти (одобрување од Директор). */
export const monthlyPlanRouter: ExpressRouter = Router();
monthlyPlanRouter.use(requireAuth);

monthlyPlanRouter.get('/:month', async (req, res) => {
  const month = (req.params as { month: string }).month;
  res.json({ data: await getMonthlyPlan(month) });
});

monthlyPlanRouter.put('/:month', async (req, res) => {
  const month = (req.params as { month: string }).month;
  const input = parse(monthlyPlanPutSchema, req.body);
  const data = await putMonthlyPlan(month, input, { id: req.auth!.sub, role: req.auth!.role });
  res.json({ data });
});

monthlyPlanRouter.post('/:month/confirm', async (req, res) => {
  const month = (req.params as { month: string }).month;
  const data = await confirmMonthlyPlan(month, { id: req.auth!.sub, role: req.auth!.role });
  res.json({ data });
});

// „Генерирај следен месец" — предлог-слотови за одобрените клиенти (dir/am).
monthlyPlanRouter.post('/:month/generate', async (req, res) => {
  if (req.auth!.role !== 'dir' && req.auth!.role !== 'am') {
    throw new AppError('FORBIDDEN_ROLE', 'Само Директор или Акаунт менаџер може да генерира.', 403);
  }
  const month = (req.params as { month: string }).month;
  const data = await generateForApprovedClients(month);
  res.json({ data });
});
