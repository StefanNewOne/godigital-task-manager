import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { automationRuleCreateSchema } from '@gd/core';
import type { Prisma } from '@gd/db';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// /automation-rules
export const automationRulesRouter: ExpressRouter = Router();
automationRulesRouter.use(requireAuth);

automationRulesRouter.get('/', async (_req, res) => {
  const rules = await prisma.automationRule.findMany({ orderBy: { createdAt: 'asc' } });
  res.json({ data: rules });
});

automationRulesRouter.post('/', requireRole('dir'), async (req, res) => {
  const input = parse(automationRuleCreateSchema, req.body);
  const rule = await prisma.automationRule.create({
    data: {
      name: input.name,
      scope: input.scope,
      clientId: input.clientId,
      trigger: input.trigger as Prisma.InputJsonValue,
      conditions: input.conditions as Prisma.InputJsonValue,
      actions: input.actions as Prisma.InputJsonValue,
      enabled: input.enabled,
      isSystem: false,
      createdById: req.auth!.sub,
    },
  });
  res.status(201).json({ data: rule });
});

automationRulesRouter.post('/:id/toggle', requireRole('dir'), async (req, res) => {
  const id = (req.params as { id: string }).id;
  const rule = await prisma.automationRule.findUnique({ where: { id } });
  if (!rule) throw new AppError('NOT_FOUND', 'Правилото не е пронајдено.', 404);
  const updated = await prisma.automationRule.update({
    where: { id },
    data: { enabled: !rule.enabled },
  });
  res.json({ data: updated });
});

// /automation-runs
export const automationRunsRouter: ExpressRouter = Router();
automationRunsRouter.use(requireAuth);

automationRunsRouter.get('/', async (_req, res) => {
  const runs = await prisma.automationRun.findMany({ orderBy: { ranAt: 'desc' }, take: 100 });
  res.json({ data: runs });
});
