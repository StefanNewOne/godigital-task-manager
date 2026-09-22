import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { dateChangeSchema, taskTransitionSchema } from '@gd/core';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { changeTaskDate } from '../services/slots.js';
import { transitionTask } from '../services/workflow/transition.js';

export const tasksRouter: ExpressRouter = Router();
tasksRouter.use(requireAuth);

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
