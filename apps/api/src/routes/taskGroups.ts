import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { groupTransitionSchema } from '@gd/core';
import type { Prisma } from '@gd/db';
import { prisma } from '../db/tenantExtension.js';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { bulkActivateGraphic, transitionTaskGroup } from '../services/workflow/groupTransition.js';

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
