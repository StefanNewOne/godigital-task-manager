import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { clientContactCreateSchema, clientContactUpdateSchema } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { recordEvent } from '../lib/events.js';
import { parse } from '../lib/validate.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

/** Контакти на клиент (A1). Никогаш тврдо бришење — архивирање преку archivedAt (И6). */

// Вгнездено под /clients/:id/contacts (list + create).
export const clientContactsRouter: ExpressRouter = Router({ mergeParams: true });
clientContactsRouter.use(requireAuth);

clientContactsRouter.get('/', async (req, res) => {
  const clientId = (req.params as { id: string }).id;
  const contacts = await prisma.clientContact.findMany({
    where: { clientId, archivedAt: null },
    orderBy: { name: 'asc' },
  });
  res.json({ data: contacts });
});

clientContactsRouter.post('/', requireRole('dir'), async (req, res) => {
  const clientId = (req.params as { id: string }).id;
  const input = parse(clientContactCreateSchema, req.body);
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true },
  });
  if (!client) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);
  const contact = await prisma.$transaction(async (tx) => {
    const created = await tx.clientContact.create({ data: { clientId, ...input } });
    await recordEvent(tx, {
      eventType: 'clientContact.created',
      objectType: 'client',
      objectId: clientId,
      clientId,
      newValue: { name: created.name },
      narrative: `Внесен контакт „${created.name}" за клиент „${client.name}".`,
    });
    return created;
  });
  res.status(201).json({ data: contact });
});

// Топ-ниво /contacts/:contactId (update / archive).
export const contactsRouter: ExpressRouter = Router();
contactsRouter.use(requireAuth);

contactsRouter.patch('/:contactId', requireRole('dir'), async (req, res) => {
  const contactId = (req.params as { contactId: string }).contactId;
  const { archived, ...rest } = parse(clientContactUpdateSchema, req.body);
  const existing = await prisma.clientContact.findUnique({ where: { id: contactId } });
  if (!existing) throw new AppError('NOT_FOUND', 'Контактот не е пронајден.', 404);
  const contact = await prisma.$transaction(async (tx) => {
    const updated = await tx.clientContact.update({
      where: { id: contactId },
      data: {
        ...rest,
        ...(archived !== undefined ? { archivedAt: archived ? new Date() : null } : {}),
      },
    });
    await recordEvent(tx, {
      eventType: 'clientContact.updated',
      objectType: 'client',
      objectId: existing.clientId,
      clientId: existing.clientId,
      narrative: `Ажуриран контакт „${updated.name}".`,
    });
    return updated;
  });
  res.json({ data: contact });
});
