import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { calendarConfigSchema } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';
import { parse } from '../lib/validate.js';
import { recordEvent } from '../lib/events.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

/**
 * СТАНДАРДЕН календар (редизајн Парче 2): `clientId = null`, важи за клиенти со
 * `calendarType = standarden`. Го поставува Акаунт менаџер (или Директор) без одобрување.
 * Mounted at /calendar/standard
 */
export const standardCalendarRouter: ExpressRouter = Router();

standardCalendarRouter.use(requireAuth);

standardCalendarRouter.get('/', async (_req, res) => {
  const configs = await prisma.calendarConfig.findMany({ where: { clientId: null } });
  res.json({ data: configs });
});

// Upsert по contentType за стандардниот календар (clientId = null).
standardCalendarRouter.put('/', requireRole('dir', 'am'), async (req, res) => {
  const input = parse(calendarConfigSchema, req.body);

  const config = await prisma.$transaction(async (tx) => {
    const existing = await tx.calendarConfig.findFirst({
      where: { clientId: null, contentType: input.contentType },
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
            clientId: null,
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
      narrative: `Стандарден календар за ${input.contentType} зачуван.`,
    });
    return saved;
  });
  res.json({ data: config });
});
