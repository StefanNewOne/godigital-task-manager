import { clientActiveForDate, endOfMonthUtc, type Role } from '@gd/core';
import type { Client } from '@gd/db';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { recordEvent } from '../lib/events.js';

const dmy = (d: Date) =>
  `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;

/**
 * Гејт: клиентот мора да е активен за дадениот датум. Кога Директор изгаси клиент, датумите
 * може да се закажат/активираат само до крај на месецот на гасењето (@gd/core).
 * Фрла `CLIENT_DEACTIVATED` со македонска порака за toast.
 */
export function assertClientActiveForDate(
  client: Pick<Client, 'deactivatedAt' | 'name'>,
  date: Date,
): void {
  if (clientActiveForDate(client.deactivatedAt, date)) return;
  const cutoff = client.deactivatedAt ? endOfMonthUtc(client.deactivatedAt) : null;
  throw new AppError(
    'CLIENT_DEACTIVATED',
    `Клиентот „${client.name}" е деактивиран — датуми може да се закажат само до ${cutoff ? dmy(cutoff) : 'крај на месецот'}.`,
    400,
  );
}

/** Директор гаси клиент: сетира `deactivatedAt` (ако веќе не е). Идемпотентно. */
export async function deactivateClient(clientId: string, actor: { id: string; role: Role }) {
  if (actor.role !== 'dir') {
    throw new AppError('FORBIDDEN_ROLE', 'Само Директор може да деактивира клиент.', 403);
  }
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);
  if (client.deactivatedAt) return client;

  return prisma.$transaction(async (tx) => {
    const at = new Date();
    const updated = await tx.client.update({
      where: { id: clientId },
      data: { deactivatedAt: at },
    });
    await recordEvent(tx, {
      eventType: 'client.deactivated',
      objectType: 'client',
      objectId: clientId,
      clientId,
      newValue: { deactivatedAt: at.toISOString() },
      narrative: `Директорот го деактивираше клиентот „${client.name}" — закажување дозволено само до ${dmy(endOfMonthUtc(at))}.`,
    });
    return updated;
  });
}

/** Директор пали (реактивира) клиент: чисти `deactivatedAt`. Идемпотентно. */
export async function reactivateClient(clientId: string, actor: { id: string; role: Role }) {
  if (actor.role !== 'dir') {
    throw new AppError('FORBIDDEN_ROLE', 'Само Директор може да активира клиент.', 403);
  }
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);
  if (!client.deactivatedAt) return client;

  return prisma.$transaction(async (tx) => {
    const updated = await tx.client.update({
      where: { id: clientId },
      data: { deactivatedAt: null },
    });
    await recordEvent(tx, {
      eventType: 'client.reactivated',
      objectType: 'client',
      objectId: clientId,
      clientId,
      narrative: `Директорот повторно го активираше клиентот „${client.name}".`,
    });
    return updated;
  });
}
