import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { scenarioUpdateSchema } from '@gd/core';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { updateScenario } from '../services/scenarios.js';

export const scenariosRouter: ExpressRouter = Router();
scenariosRouter.use(requireAuth);

scenariosRouter.patch('/:id', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const input = parse(scenarioUpdateSchema, req.body);
  const scenario = await updateScenario(id, input, { id: req.auth!.sub, role: req.auth!.role });
  res.json({ data: scenario });
});
