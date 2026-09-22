import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { promotionCreateSchema } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { recordEvent } from '../lib/events.js';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';

export const publicationsRouter: ExpressRouter = Router();
publicationsRouter.use(requireAuth);

const DECISION_LABEL: Record<string, string> = { organic: 'органски', paid: 'во реклами' };

// Одлука за промоција (органски/платено) по објава — задоволува G_DECISION (analitika→zavrseno).
publicationsRouter.post('/:id/promotion', async (req, res) => {
  const publicationId = (req.params as { id: string }).id;
  const input = parse(promotionCreateSchema, req.body);
  if (req.auth!.role !== 'ana' && req.auth!.role !== 'dir') {
    throw new AppError('FORBIDDEN_ROLE', 'Само Аналитичар може да внесе одлука за промоција.', 403);
  }
  const pub = await prisma.publication.findUnique({
    where: { id: publicationId },
    include: { task: { select: { clientId: true } } },
  });
  if (!pub) throw new AppError('NOT_FOUND', 'Објавата не е пронајдена.', 404);

  const promotion = await prisma.$transaction(async (tx) => {
    const data = {
      decision: input.decision,
      rationale: input.rationale,
      campaignId: input.campaignId,
      decidedById: req.auth!.sub,
    };
    const p = await tx.promotion.upsert({
      where: { publicationId },
      create: { publicationId, ...data },
      update: data,
    });
    await recordEvent(tx, {
      eventType: 'promotion.decided',
      objectType: 'publication',
      objectId: publicationId,
      taskId: pub.taskId,
      clientId: pub.task.clientId,
      newValue: { decision: input.decision },
      narrative: `Одлука за промоција: ${DECISION_LABEL[input.decision]}.`,
    });
    return p;
  });
  res.json({ data: promotion });
});
