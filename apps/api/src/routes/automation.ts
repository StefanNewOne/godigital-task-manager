import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { automationRuleInputSchema, type AutomationRuleInput } from '@gd/core';
import type { Prisma } from '@gd/db';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { requireAuth, requireRole, requireScreen } from '../middleware/auth.js';

// /automation-rules — Админ конфигурација: само улоги со екран „admin" во nav (defense in depth).
export const automationRulesRouter: ExpressRouter = Router();
automationRulesRouter.use(requireAuth, requireScreen('admin'));

/** Мапирање на типизиран влез → DB колони (trigger/conditions/actions, H3/ADR-001). */
function toData(input: AutomationRuleInput) {
  return {
    name: input.name,
    scope: input.scope ?? 'global',
    clientId: input.clientId ?? null,
    trigger: { type: input.spec.type } as Prisma.InputJsonValue,
    conditions: input.spec as Prisma.InputJsonValue,
    actions: input.action as Prisma.InputJsonValue,
    enabled: input.enabled,
  };
}

automationRulesRouter.get('/', async (_req, res) => {
  const rules = await prisma.automationRule.findMany({
    where: { archivedAt: null },
    orderBy: { createdAt: 'asc' },
  });
  res.json({ data: rules });
});

automationRulesRouter.post('/', requireRole('dir'), async (req, res) => {
  // Cast: parse() применува defaults во runtime; z.infer (output) е вистинскиот облик.
  const input = parse(automationRuleInputSchema, req.body) as AutomationRuleInput;
  const rule = await prisma.automationRule.create({
    data: { ...toData(input), isSystem: false, createdById: req.auth!.sub },
  });
  res.status(201).json({ data: rule });
});

automationRulesRouter.patch('/:id', requireRole('dir'), async (req, res) => {
  const id = (req.params as { id: string }).id;
  const existing = await prisma.automationRule.findUnique({ where: { id } });
  if (!existing || existing.archivedAt) {
    throw new AppError('NOT_FOUND', 'Правилото не е пронајдено.', 404);
  }
  const input = parse(automationRuleInputSchema, req.body) as AutomationRuleInput;
  // Системско правило: типот на тригерот е заклучен (може само прагови/акција/вклучено).
  const existingType = (existing.trigger as { type?: string } | null)?.type;
  if (existing.isSystem && existingType && input.spec.type !== existingType) {
    throw new AppError(
      'VALIDATION_FAILED',
      'Типот на системско правило не може да се менува.',
      400,
    );
  }
  const updated = await prisma.automationRule.update({ where: { id }, data: toData(input) });
  res.json({ data: updated });
});

automationRulesRouter.delete('/:id', requireRole('dir'), async (req, res) => {
  const id = (req.params as { id: string }).id;
  const existing = await prisma.automationRule.findUnique({ where: { id } });
  if (!existing || existing.archivedAt) {
    throw new AppError('NOT_FOUND', 'Правилото не е пронајдено.', 404);
  }
  if (existing.isSystem) {
    throw new AppError('VALIDATION_FAILED', 'Системско правило не може да се избрише.', 400);
  }
  // Soft-delete (И6).
  const archived = await prisma.automationRule.update({
    where: { id },
    data: { archivedAt: new Date() },
  });
  res.json({ data: archived });
});

automationRulesRouter.post('/:id/toggle', requireRole('dir'), async (req, res) => {
  const id = (req.params as { id: string }).id;
  const rule = await prisma.automationRule.findUnique({ where: { id } });
  if (!rule || rule.archivedAt) throw new AppError('NOT_FOUND', 'Правилото не е пронајдено.', 404);
  const updated = await prisma.automationRule.update({
    where: { id },
    data: { enabled: !rule.enabled },
  });
  res.json({ data: updated });
});

// /automation-runs — Админ конфигурација: само улоги со екран „admin" во nav.
export const automationRunsRouter: ExpressRouter = Router();
automationRunsRouter.use(requireAuth, requireScreen('admin'));

automationRunsRouter.get('/', async (_req, res) => {
  const runs = await prisma.automationRun.findMany({ orderBy: { ranAt: 'desc' }, take: 100 });
  res.json({ data: runs });
});
