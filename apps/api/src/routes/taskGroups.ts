import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import {
  PERMISSIONS,
  groupTransitionSchema,
  scenarioOutcomesSchema,
  scenarioSplitSchema,
} from '@gd/core';
import type { Prisma } from '@gd/db';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { bulkActivateGraphic, transitionTaskGroup } from '../services/workflow/groupTransition.js';
import { setScenarioOutcomes, splitScenarios } from '../services/scenarios.js';
import { archiveLocally, extendRaw } from '../services/storage.js';

export const taskGroupsRouter: ExpressRouter = Router();
taskGroupsRouter.use(requireAuth);

taskGroupsRouter.get('/', async (req, res) => {
  const { clientId, month, type } = req.query as Record<string, string | undefined>;
  const where: Prisma.TaskGroupWhereInput = {};
  if (clientId) where.clientId = clientId;
  if (month) where.monthKey = month;
  if (type === 'video' || type === 'graphic') where.contentType = type;
  // Опсег (И4): own-scope роли гледаат само капи каде се вклучени (scenarist/rez/kam).
  if (PERMISSIONS[req.auth!.role].scope === 'own') {
    where.OR = [{ scenaristId: req.auth!.sub }, { rezId: req.auth!.sub }, { kamId: req.auth!.sub }];
  }
  const groups = await prisma.taskGroup.findMany({ where, orderBy: { monthKey: 'desc' } });
  // Сценарио бројки по група (за капа-картичката „N од M сценарија одобрени").
  const scenarios = await prisma.scenario.findMany({
    where: { groupId: { in: groups.map((g) => g.id) } },
    select: { groupId: true, status: true },
  });
  const counts = new Map<string, { total: number; approved: number }>();
  for (const sc of scenarios) {
    const c = counts.get(sc.groupId) ?? { total: 0, approved: 0 };
    c.total += 1;
    if (sc.status === 'odobreno' || sc.status === 'odobrenoSoIzmeni') c.approved += 1;
    counts.set(sc.groupId, c);
  }
  const data = groups.map((g) => ({
    ...g,
    scenariosTotal: counts.get(g.id)?.total ?? 0,
    scenariosApproved: counts.get(g.id)?.approved ?? 0,
  }));
  res.json({ data });
});

// Единечна капа за Капа панелот (read-only) + мал резиме на деца/заеднички фајлови.
taskGroupsRouter.get('/:id', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const group = await prisma.taskGroup.findUnique({
    where: { id },
    include: { client: { select: { name: true } } },
  });
  if (!group) throw new AppError('NOT_FOUND', 'Капа таскот не е пронајден.', 404);
  // own-scope смее да ја отвори само капата каде е вклучен (не открива постоење на туѓа).
  if (
    PERMISSIONS[req.auth!.role].scope === 'own' &&
    ![group.scenaristId, group.rezId, group.kamId].includes(req.auth!.sub)
  ) {
    throw new AppError('NOT_FOUND', 'Капа таскот не е пронајден.', 404);
  }
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

/** Сторидж акции на суров материјал (H7) — управуваат Директор / Акаунт менаџер. */
function requireStorageManager(role: string): void {
  if (role !== 'dir' && role !== 'am') {
    throw new AppError(
      'FORBIDDEN_ROLE',
      'Само Директор или Акаунт менаџер може да управува со сторидж.',
      403,
    );
  }
}

// Продолжи го животот на суровиот материјал за +30 дена.
taskGroupsRouter.post('/:id/storage/extend', async (req, res) => {
  requireStorageManager(req.auth!.role);
  const id = (req.params as { id: string }).id;
  const group = await extendRaw(id);
  if (!group) throw new AppError('NOT_FOUND', 'Капата не е пронајдена.', 404);
  res.json({ data: group });
});

// Означи локална архива (суровиот материјал нема да се брише од сторидж).
taskGroupsRouter.post('/:id/storage/archive', async (req, res) => {
  requireStorageManager(req.auth!.role);
  const id = (req.params as { id: string }).id;
  const path = (req.body as { path?: string })?.path;
  if (typeof path !== 'string' || path.trim() === '') {
    throw new AppError('GUARD_FAILED', 'Патеката до локалната архива е задолжителна.', 400);
  }
  const group = await archiveLocally(id, path.trim());
  if (!group) throw new AppError('NOT_FOUND', 'Капата не е пронајдена.', 404);
  res.json({ data: group });
});
