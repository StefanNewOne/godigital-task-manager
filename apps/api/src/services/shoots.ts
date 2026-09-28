import type { Role } from '@gd/core';
import { prisma, type TxClient } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { recordEvent } from '../lib/events.js';

/** Основен термин на снимање при podgotovka→scenarija (ако има датум). Идемпотентно. */
export async function ensurePrimaryShoot(
  tx: TxClient,
  group: { id: string; clientId: string; shootDate: Date | null; shootLocation: string | null },
): Promise<void> {
  if (!group.shootDate) return;
  const existing = await tx.shootSession.findFirst({
    where: { groupId: group.id, kind: 'primary' },
  });
  if (existing) {
    await tx.shootSession.update({
      where: { id: existing.id },
      data: { date: group.shootDate, location: group.shootLocation ?? existing.location },
    });
    return;
  }
  await tx.shootSession.create({
    data: {
      groupId: group.id,
      clientId: group.clientId,
      date: group.shootDate,
      location: group.shootLocation ?? '',
      kind: 'primary',
    },
  });
}

/** Камерман (или Режисер/Директор) додава дополнителен термин на снимање — само во статус snimanje. */
export async function addShootSession(
  groupId: string,
  input: { date: Date; location: string },
  actor: { id: string; role: Role },
) {
  if (!['kam', 'rez', 'dir'].includes(actor.role)) {
    throw new AppError('FORBIDDEN_ROLE', 'Само Камерман може да додаде снимање.', 403);
  }
  const group = await prisma.taskGroup.findUnique({
    where: { id: groupId },
    include: { client: { select: { name: true } } },
  });
  if (!group) throw new AppError('NOT_FOUND', 'Капа таскот не е пронајден.', 404);
  if (group.status !== 'snimanje') {
    throw new AppError('VALIDATION_FAILED', 'Дополнително снимање само во статус „Снимање".', 400);
  }
  if (!input.location.trim()) {
    throw new AppError('VALIDATION_FAILED', 'Локацијата е задолжителна.', 400);
  }

  return prisma.$transaction(async (tx) => {
    const shoot = await tx.shootSession.create({
      data: {
        groupId,
        clientId: group.clientId,
        date: input.date,
        location: input.location.trim(),
        kind: 'additional',
      },
    });
    await recordEvent(tx, {
      eventType: 'shoot.added',
      objectType: 'group',
      objectId: groupId,
      groupId,
      clientId: group.clientId,
      newValue: { date: input.date.toISOString(), location: input.location.trim() },
      narrative: `Дополнително снимање за „${group.client.name}" на ${input.date.toISOString().slice(0, 10)} · ${input.location.trim()}.`,
    });
    return shoot;
  });
}

/** Термините за капата (за Капа панелот). */
export async function listGroupShoots(groupId: string) {
  return prisma.shootSession.findMany({ where: { groupId }, orderBy: { date: 'asc' } });
}

export interface ShootCalendarItem {
  id: string;
  groupId: string;
  date: string;
  location: string;
  kind: string;
  clientName: string;
  clientColor: string;
  monthKey: string;
  status: string;
}

/** „Календар на снимање": сите термини во месец со клиент/капа инфо (Режисер/Директор/Камерман). */
export async function listShootCalendar(month: string): Promise<ShootCalendarItem[]> {
  const [y, m] = month.split('-').map(Number);
  const start = new Date(Date.UTC(y!, m! - 1, 1));
  const end = new Date(Date.UTC(y!, m!, 1));
  const rows = await prisma.shootSession.findMany({
    where: { date: { gte: start, lt: end } },
    orderBy: { date: 'asc' },
    include: {
      group: {
        select: { monthKey: true, status: true, client: { select: { name: true, color: true } } },
      },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    groupId: r.groupId,
    date: r.date.toISOString(),
    location: r.location,
    kind: r.kind,
    clientName: r.group.client.name,
    clientColor: r.group.client.color,
    monthKey: r.group.monthKey,
    status: r.group.status,
  }));
}
