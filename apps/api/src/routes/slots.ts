import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { slotConfirmSchema, slotGenerateSchema, slotPatchSchema } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { recordEvent } from '../lib/events.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { confirmMonth, generateProposalSlots } from '../services/slots.js';

// Mounted at /clients/:id/slots
export const clientSlotsRouter: ExpressRouter = Router({ mergeParams: true });
clientSlotsRouter.use(requireAuth);

clientSlotsRouter.get('/', async (req, res) => {
  const clientId = (req.params as { id: string }).id;
  const month = typeof req.query.month === 'string' ? req.query.month : undefined;
  const slots = await prisma.publishingSlot.findMany({
    where: { clientId, ...(month ? { monthKey: month } : {}) },
    orderBy: [{ date: 'asc' }, { orderInDay: 'asc' }],
    include: {
      task: { select: { id: true, status: true, title: true, contentType: true } },
    },
  });
  res.json({ data: slots });
});

clientSlotsRouter.post('/generate', requireRole('dir', 'am'), async (req, res) => {
  const { month } = parse(slotGenerateSchema, req.body);
  const slots = await generateProposalSlots((req.params as { id: string }).id, month);
  res.status(201).json({ data: slots });
});

clientSlotsRouter.post('/confirm', requireRole('dir', 'am'), async (req, res) => {
  const { month } = parse(slotConfirmSchema, req.body);
  const result = await confirmMonth((req.params as { id: string }).id, month);
  res.json({ data: result });
});

// Mounted at /slots
export const slotsRouter: ExpressRouter = Router();
slotsRouter.use(requireAuth);

// Глобален календар: слотови за сите клиенти за даден месец (tenant-scoped преку extension).
slotsRouter.get('/all', async (req, res) => {
  const month = typeof req.query.month === 'string' ? req.query.month : undefined;
  const slots = await prisma.publishingSlot.findMany({
    where: { ...(month ? { monthKey: month } : {}) },
    orderBy: [{ date: 'asc' }, { orderInDay: 'asc' }],
    include: {
      task: { select: { id: true, status: true, title: true, contentType: true } },
    },
  });
  res.json({ data: slots });
});

// Уредување на предлог-слот (H1: влечење без причина). Само predlog слотови.
slotsRouter.patch('/:id', requireRole('dir', 'am', 'rez', 'krea'), async (req, res) => {
  const id = (req.params as { id: string }).id;
  const input = parse(slotPatchSchema, req.body);
  const slot = await prisma.publishingSlot.findUnique({ where: { id } });
  if (!slot) throw new AppError('NOT_FOUND', 'Слотот не е пронајден.', 404);
  if (slot.status !== 'predlog') {
    throw new AppError('VALIDATION_FAILED', 'Само предлог-слотови може да се уредуваат тука.', 400);
  }
  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.publishingSlot.update({
      where: { id },
      data: { date: input.date, orderInDay: input.orderInDay ?? slot.orderInDay },
    });
    await recordEvent(
      tx,
      {
        eventType: 'slot.moved',
        objectType: 'slot',
        objectId: id,
        clientId: slot.clientId,
        narrative: `Поместен предлог-слот на ${input.date.toISOString().slice(0, 10)}.`,
      },
      ['realtime'],
    );
    return u;
  });
  res.json({ data: updated });
});
