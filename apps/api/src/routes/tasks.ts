import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import {
  PERMISSIONS,
  commentCreateSchema,
  dateChangeSchema,
  taskListQuerySchema,
  taskTransitionSchema,
} from '@gd/core';
import type { Prisma } from '@gd/db';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { changeTaskDate } from '../services/slots.js';
import { transitionTask } from '../services/workflow/transition.js';

export const tasksRouter: ExpressRouter = Router();
tasksRouter.use(requireAuth);

const slotSelect = { select: { date: true, orderInDay: true, status: true } } as const;

// Листа на таскови со scope (И4): 'own' гледа само свои, 'all' гледа сè (PRD §4.11).
tasksRouter.get('/', async (req, res) => {
  const q = parse(taskListQuerySchema, req.query);
  const scope = PERMISSIONS[req.auth!.role].scope;
  const where: Prisma.TaskWhereInput = {};
  if (scope === 'own') where.assigneeId = req.auth!.sub;
  if (q.assigneeId) where.assigneeId = q.assigneeId;
  if (q.clientId) where.clientId = q.clientId;
  if (q.type) where.contentType = q.type;
  if (q.status) where.status = q.status;
  if (q.month) where.group = { monthKey: q.month };
  if (q.q) where.title = { contains: q.q, mode: 'insensitive' };

  const tasks = await prisma.task.findMany({
    where,
    include: { slot: slotSelect },
    orderBy: [{ priority: 'desc' }, { statusChangedAt: 'asc' }],
  });
  res.json({ data: tasks });
});

tasksRouter.get('/:id', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const task = await prisma.task.findUnique({
    where: { id },
    include: { slot: slotSelect, client: { select: { name: true, usesMetaAds: true } } },
  });
  if (!task) throw new AppError('NOT_FOUND', 'Таскот не е пронајден.', 404);
  // scope 'own' не смее да гледа туѓ таск (не открива постоење).
  if (PERMISSIONS[req.auth!.role].scope === 'own' && task.assigneeId !== req.auth!.sub) {
    throw new AppError('NOT_FOUND', 'Таскот не е пронајден.', 404);
  }
  res.json({ data: task });
});

// Активност: EventLog + Comment споени хронолошки (PRD Task Detail „Активност").
tasksRouter.get('/:id/activity', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const [events, comments] = await Promise.all([
    prisma.eventLog.findMany({ where: { taskId: id }, orderBy: { occurredAt: 'asc' } }),
    prisma.comment.findMany({ where: { taskId: id }, orderBy: { createdAt: 'asc' } }),
  ]);
  const feed = [
    ...events.map((e) => ({
      kind: 'event' as const,
      at: e.occurredAt,
      actorId: e.actorId,
      text: e.narrative,
      eventType: e.eventType,
    })),
    ...comments.map((c) => ({
      kind: 'comment' as const,
      at: c.createdAt,
      actorId: c.authorId,
      text: c.body,
      mentions: c.mentions,
    })),
  ].sort((a, b) => a.at.getTime() - b.at.getTime());
  res.json({ data: feed });
});

// Коментар со @тагирање (D-9). Тагираните добиваат потсетник (Notification) во B1.
tasksRouter.post('/:id/comments', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const input = parse(commentCreateSchema, req.body);
  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true, clientId: true },
  });
  if (!task) throw new AppError('NOT_FOUND', 'Таскот не е пронајден.', 404);
  const comment = await prisma.comment.create({
    data: {
      taskId: id,
      authorId: req.auth!.sub,
      body: input.body,
      mentions: input.mentions ?? [],
    },
  });
  res.status(201).json({ data: comment });
});

// Промена на статус преку state machine (PRD §4.3).
tasksRouter.post('/:id/transition', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const { to, payload } = parse(taskTransitionSchema, req.body);
  const task = await transitionTask(id, to, payload ?? {}, {
    id: req.auth!.sub,
    role: req.auth!.role,
  });
  res.json({ data: task });
});

tasksRouter.post('/:id/date-change', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const input = parse(dateChangeSchema, req.body);
  const task = await changeTaskDate(id, input, { id: req.auth!.sub, role: req.auth!.role });
  res.json({ data: task });
});
