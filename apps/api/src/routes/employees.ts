import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { employeeCreateSchema, employeeUpdateSchema } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { recordEvent } from '../lib/events.js';
import { hashPassword } from '../lib/auth.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { employeeSafeSelect } from './auth.js';

export const employeesRouter: ExpressRouter = Router();

employeesRouter.use(requireAuth);

employeesRouter.get('/', async (_req, res) => {
  const employees = await prisma.employee.findMany({
    where: { archivedAt: null },
    select: { ...employeeSafeSelect, phone: true, capacityNote: true, createdById: true },
    orderBy: { name: 'asc' },
  });
  res.json({ data: employees });
});

employeesRouter.post('/', requireRole('dir'), async (req, res) => {
  const input = parse(employeeCreateSchema, req.body);
  const existing = await prisma.employee.findUnique({ where: { email: input.email } });
  if (existing) throw new AppError('VALIDATION_FAILED', 'Веќе постои вработен со тој е-мејл.', 400);
  const passwordHash = await hashPassword(input.password);
  const employee = await prisma.$transaction(async (tx) => {
    const created = await tx.employee.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        phone: input.phone,
        role: input.role,
        isScenaristToo: input.isScenaristToo,
        color: input.color,
        capacityNote: input.capacityNote,
        createdById: req.auth!.sub,
      },
      select: employeeSafeSelect,
    });
    await recordEvent(tx, {
      eventType: 'employee.created',
      objectType: 'employee',
      objectId: created.id,
      newValue: { name: created.name, role: created.role },
      narrative: `Внесен вработен „${created.name}" (${created.role}).`,
    });
    return created;
  });
  res.status(201).json({ data: employee });
});

employeesRouter.patch('/:id', requireRole('dir'), async (req, res) => {
  const input = parse(employeeUpdateSchema, req.body);
  const existing = await prisma.employee.findUnique({
    where: { id: (req.params as { id: string }).id },
  });
  if (!existing) throw new AppError('NOT_FOUND', 'Вработениот не е пронајден.', 404);
  if (input.isScenaristToo && (input.role ?? existing.role) !== 'rez') {
    throw new AppError('VALIDATION_FAILED', 'isScenaristToo е дозволено само за Режисер.', 400);
  }
  const employee = await prisma.$transaction(async (tx) => {
    const updated = await tx.employee.update({
      where: { id: existing.id },
      data: input,
      select: employeeSafeSelect,
    });
    await recordEvent(tx, {
      eventType: 'employee.updated',
      objectType: 'employee',
      objectId: updated.id,
      narrative: `Ажуриран вработен „${updated.name}".`,
    });
    return updated;
  });
  res.json({ data: employee });
});
