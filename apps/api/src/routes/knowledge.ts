import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { searchKnowledge } from '../services/knowledge/search.js';

export const knowledgeRouter: ExpressRouter = Router();
knowledgeRouter.use(requireAuth);

const searchSchema = z.object({
  query: z.string().min(1, 'Прашањето е задолжително.'),
  clientId: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(20).optional(),
});

// Хибридно пребарување на знаење (B4). ACL: tenant + опционен client scope во сервисот.
knowledgeRouter.post('/search', async (req, res) => {
  const input = parse(searchSchema, req.body);
  const hits = await searchKnowledge(input.query, { clientId: input.clientId, limit: input.limit });
  res.json({ data: hits });
});
