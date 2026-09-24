import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { z } from 'zod';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { getAssistantProvider } from '../services/knowledge/assistant.js';
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

const askSchema = z.object({
  question: z.string().min(1, 'Прашањето е задолжително.'),
  clientId: z.string().uuid().optional(),
});

// Claude помошник (B4, RAG): пребарува знаење → одговара само од контекст (никогаш не менува).
// Гатиран по клиент со модулот `claudeAssistant` (ModuleAssignment).
knowledgeRouter.post('/assistant/ask', async (req, res) => {
  const input = parse(askSchema, req.body);
  if (input.clientId) {
    const mod = await prisma.moduleAssignment.findFirst({
      where: { clientId: input.clientId, module: 'claudeAssistant', active: true },
      select: { id: true },
    });
    if (!mod) {
      throw new AppError('FORBIDDEN_ROLE', 'Claude помошникот не е активиран за овој клиент.', 403);
    }
  }
  const hits = await searchKnowledge(input.question, { clientId: input.clientId, limit: 8 });
  const result = await getAssistantProvider().answer(input.question, hits);
  res.json({
    data: {
      answer: result.answer,
      grounded: result.grounded,
      sources: hits.map((h) => ({
        sourceType: h.sourceType,
        sourceId: h.sourceId,
        text: h.text.slice(0, 200),
      })),
    },
  });
});
