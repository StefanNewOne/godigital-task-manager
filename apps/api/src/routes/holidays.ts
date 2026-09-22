import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { holidayCreateSchema } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';
import { parse } from '../lib/validate.js';
import { recordEvent } from '../lib/events.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const holidaysRouter: ExpressRouter = Router();

holidaysRouter.use(requireAuth);

holidaysRouter.get('/', async (_req, res) => {
  const holidays = await prisma.holiday.findMany({ orderBy: { date: 'asc' } });
  res.json({ data: holidays });
});

holidaysRouter.post('/', requireRole('dir'), async (req, res) => {
  const input = parse(holidayCreateSchema, req.body);
  const holiday = await prisma.$transaction(async (tx) => {
    const created = await tx.holiday.create({
      data: {
        date: input.date,
        name: input.name,
        scope: input.scope,
        clientId: input.clientId,
      },
    });
    await recordEvent(
      tx,
      {
        eventType: 'holiday.created',
        objectType: 'holiday',
        objectId: created.id,
        clientId: input.clientId ?? null,
        narrative: `Внесен празник „${created.name}".`,
      },
      ['realtime'],
    );
    return created;
  });
  res.status(201).json({ data: holiday });
});
