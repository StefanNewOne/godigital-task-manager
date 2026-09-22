import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { groupTransitionSchema, scenarioOutcomesSchema, scenarioSplitSchema } from '@gd/core';
import type { Prisma } from '@gd/db';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { bulkActivateGraphic, transitionTaskGroup } from '../services/workflow/groupTransition.js';
import { setScenarioOutcomes, splitScenarios } from '../services/scenarios.js';

export const taskGroupsRouter: ExpressRouter = Router();
taskGroupsRouter.use(requireAuth);

taskGroupsRouter.get('/', async (req, res) => {
  const { clientId, month, type } = req.query as Record<string, string | undefined>;
  const where: Prisma.TaskGroupWhereInput = {};
  if (clientId) where.clientId = clientId;
  if (month) where.monthKey = month;
  if (type === 'video' || type === 'graphic') where.contentType = type;
  const groups = await prisma.taskGroup.findMany({ where, orderBy: { monthKey: 'desc' } });
  res.json({ data: groups });
});

// Единечна капа за Капа панелот (read-only) + мал резиме на деца/заеднички фајлови.
taskGroupsRouter.get('/:id', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const group = await prisma.taskGroup.findUnique({
    where: { id },
    include: { client: { select: { name: true } } },
  });
  if (!group) throw new AppError('NOT_FOUND', 'Капа таскот не е пронајден.', 404);
  const [totalChildren, activeChildren, sharedFiles] = await Promise.all([
    prisma.task.count({ where: { groupId: id } }),
    prisma.task.count({ where: { groupId: id, status: { not: 'mrtov' } } }),
    prisma.fileAsset.count({ where: { ownerType: 'group', ownerId: id } }),
  ]);
  res.json({ data: { ...group, totalChildren, activeChildren, sharedFiles } });
});

// Bulk активација на графички слотови (D-3).
taskGroupsRouter.post('/:id/activate-all', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const result = await bulkActivateGraphic(id, { id: req.auth!.sub, role: req.auth!.role });
  res.json({ data: result });
});

taskGroupsRouter.post('/:id/transition', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const { to, payload } = parse(groupTransitionSchema, req.body);
  const group = await transitionTaskGroup(id, to, payload ?? {}, {
    id: req.auth!.sub,
    role: req.auth!.role,
  });
  res.json({ data: group });
});

// Сценарија на видео капа (A4).
taskGroupsRouter.get('/:id/scenarios', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const scenarios = await prisma.scenario.findMany({
    where: { groupId: id },
    orderBy: { ordinal: 'asc' },
  });
  res.json({ data: scenarios });
});

taskGroupsRouter.post('/:id/scenarios', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const input = parse(scenarioSplitSchema, req.body);
  const scenarios = await splitScenarios(id, input, { id: req.auth!.sub, role: req.auth!.role });
  res.status(201).json({ data: scenarios });
});

taskGroupsRouter.post('/:id/scenario-outcomes', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const input = parse(scenarioOutcomesSchema, req.body);
  const scenarios = await setScenarioOutcomes(id, input, {
    id: req.auth!.sub,
    role: req.auth!.role,
  });
  res.json({ data: scenarios });
});
