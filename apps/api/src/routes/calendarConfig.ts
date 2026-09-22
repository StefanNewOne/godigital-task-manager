import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { calendarConfigSchema } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { recordEvent } from '../lib/events.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

// Mounted at /clients/:id/calendar-config
export const calendarConfigRouter: ExpressRouter = Router({ mergeParams: true });

calendarConfigRouter.use(requireAuth);

calendarConfigRouter.get('/', async (req, res) => {
  const clientId = (req.params as { id: string }).id;
  const configs = await prisma.calendarConfig.findMany({ where: { clientId } });
  res.json({ data: configs });
});

// Upsert по (clientId, contentType).
calendarConfigRouter.put('/', requireRole('dir', 'am'), async (req, res) => {
  const clientId = (req.params as { id: string }).id;
  const input = parse(calendarConfigSchema, req.body);
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);

  const config = await prisma.$transaction(async (tx) => {
    const existing = await tx.calendarConfig.findFirst({
      where: { clientId, contentType: input.contentType },
    });
    const saved = existing
      ? await tx.calendarConfig.update({
          where: { id: existing.id },
          data: {
            weekdays: input.weekdays,
            publishTime: input.publishTime,
            allowTwoPerDay: input.allowTwoPerDay,
          },
        })
      : await tx.calendarConfig.create({
          data: {
            clientId,
            contentType: input.contentType,
            weekdays: input.weekdays,
            publishTime: input.publishTime,
            allowTwoPerDay: input.allowTwoPerDay,
          },
        });
    await recordEvent(tx, {
      eventType: 'calendarConfig.saved',
      objectType: 'calendarConfig',
      objectId: saved.id,
      clientId,
      narrative: `Календар за ${input.contentType} зачуван за „${client.name}".`,
    });
    return saved;
  });
  res.json({ data: config });
});
