import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { clientCreateSchema, clientUpdateSchema } from '@gd/core';
import type { Prisma } from '@gd/db';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { recordEvent } from '../lib/events.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

export const clientsRouter: ExpressRouter = Router();

clientsRouter.use(requireAuth);

clientsRouter.get('/', async (_req, res) => {
  const clients = await prisma.client.findMany({
    where: { archivedAt: null },
    orderBy: { name: 'asc' },
  });
  res.json({ data: clients });
});

clientsRouter.get('/:id', async (req, res) => {
  const client = await prisma.client.findUnique({
    where: { id: (req.params as { id: string }).id },
    include: { contacts: true, calendarConfigs: true, moduleAssignments: true },
  });
  if (!client) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);
  res.json({ data: client });
});

clientsRouter.post('/', requireRole('dir'), async (req, res) => {
  const input = parse(clientCreateSchema, req.body);
  const client = await prisma.$transaction(async (tx) => {
    const created = await tx.client.create({
      data: {
        ...input,
        defaultAssignees: (input.defaultAssignees ?? undefined) as
          Prisma.InputJsonValue | undefined,
      },
    });
    await recordEvent(tx, {
      eventType: 'client.created',
      objectType: 'client',
      objectId: created.id,
      clientId: created.id,
      newValue: { name: created.name },
      narrative: `Внесен нов клиент „${created.name}".`,
    });
    return created;
  });
  res.status(201).json({ data: client });
});

clientsRouter.patch('/:id', requireRole('dir'), async (req, res) => {
  const input = parse(clientUpdateSchema, req.body);
  const existing = await prisma.client.findUnique({
    where: { id: (req.params as { id: string }).id },
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);
  const client = await prisma.$transaction(async (tx) => {
    const updated = await tx.client.update({
      where: { id: existing.id },
      data: {
        ...input,
        defaultAssignees: (input.defaultAssignees ?? undefined) as
          Prisma.InputJsonValue | undefined,
      },
    });
    await recordEvent(tx, {
      eventType: 'client.updated',
      objectType: 'client',
      objectId: updated.id,
      clientId: updated.id,
      narrative: `Ажуриран клиент „${updated.name}".`,
    });
    return updated;
  });
  res.json({ data: client });
});
