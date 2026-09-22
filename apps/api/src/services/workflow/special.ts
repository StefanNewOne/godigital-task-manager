import {
  ROLE_LABEL,
  TASK_STATUS_META,
  canCancel,
  canPause,
  canResumeFromPause,
  ymd,
  type ContentType,
  type Role,
  type TaskStatus,
} from '@gd/core';
import type { TaskStatus as DbTaskStatus } from '@gd/db';
import { prisma, type TxClient } from '../../db/tenantExtension.js';
import { AppError } from '../../lib/errors.js';
import { recordEvent } from '../../lib/events.js';

/**
 * Специјални преоди (PRD §4.3, CLAUDE.md И2/И4): пауза, откажување, враќање од пауза.
 * Не се обични редови во матрицата — важат за „било кој не-терминален" статус, па живеат
 * тука наместо во TASK_TRANSITIONS. Actor-проверката е во `@gd/core` (canPause/…).
 * `E_RELEASE_SLOT` = слотот се ослободува (→ free) и се откачува од таскот.
 */

const label = (s: string) => TASK_STATUS_META[s as TaskStatus]?.label ?? s;

/** E_RELEASE_SLOT: ослободи го тековниот слот на таскот (→ free). Откачувањето е на повикувачот. */
async function releaseSlot(tx: TxClient, slotId: string | null): Promise<void> {
  if (slotId) await tx.publishingSlot.update({ where: { id: slotId }, data: { status: 'free' } });
}

/** Земи слободен слот за датумот (или создади резервиран) — за враќање од пауза (G_SLOT_FREE). */
async function acquireSlot(
  tx: TxClient,
  args: { clientId: string; contentType: ContentType; date: Date; orderInDay: number },
): Promise<string> {
  const monthKey = `${args.date.getUTCFullYear()}-${String(args.date.getUTCMonth() + 1).padStart(2, '0')}`;
  const free = await tx.publishingSlot.findFirst({
    where: {
      clientId: args.clientId,
      contentType: args.contentType,
      date: args.date,
      orderInDay: args.orderInDay,
      status: 'free',
    },
  });
  if (free) {
    await tx.publishingSlot.update({ where: { id: free.id }, data: { status: 'reserved' } });
    return free.id;
  }
  const created = await tx.publishingSlot.create({
    data: {
      clientId: args.clientId,
      contentType: args.contentType,
      date: args.date,
      orderInDay: args.orderInDay,
      status: 'reserved',
      monthKey,
    },
  });
  return created.id;
}

function assertNotPast(date: Date): void {
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const target = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  if (target < today) throw new AppError('DATE_IN_PAST', 'Датумот е во минатото.', 400);
}

/** Пауза (dir/am, G_COMMENT): статусот се памти, слотот се ослободува. */
export async function pauseTask(
  taskId: string,
  input: { reason: string },
  actor: { id: string; role: Role },
) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { client: true } });
  if (!task) throw new AppError('NOT_FOUND', 'Таскот не е пронајден.', 404);
  if (!canPause(task.status as TaskStatus, actor.role)) {
    throw new AppError('FORBIDDEN_ROLE', 'Немате дозвола да го паузирате овој таск.', 403);
  }

  return prisma.$transaction(async (tx) => {
    await releaseSlot(tx, task.slotId);
    await tx.task.update({
      where: { id: task.id },
      data: {
        pausedFromStatus: task.status,
        status: 'pauza',
        pauseReason: input.reason,
        slotId: null,
        statusChangedAt: new Date(),
      },
    });
    await recordEvent(tx, {
      eventType: 'task.paused',
      objectType: 'task',
      objectId: task.id,
      taskId: task.id,
      clientId: task.clientId,
      oldValue: { status: task.status },
      newValue: { status: 'pauza' },
      context: { reason: input.reason },
      narrative: `${ROLE_LABEL[actor.role]} го паузираше таскот „${task.title}" (од ${label(task.status)}). Слотот е ослободен. Причина: ${input.reason}.`,
    });
    return tx.task.findUnique({ where: { id: task.id } });
  });
}

/** Откажување (само dir, G_COMMENT): терминален статус, слотот се ослободува. */
export async function cancelTask(
  taskId: string,
  input: { reason: string },
  actor: { id: string; role: Role },
) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { client: true } });
  if (!task) throw new AppError('NOT_FOUND', 'Таскот не е пронајден.', 404);
  if (!canCancel(task.status as TaskStatus, actor.role)) {
    throw new AppError('FORBIDDEN_ROLE', 'Само Директор може да откаже таск.', 403);
  }

  return prisma.$transaction(async (tx) => {
    await releaseSlot(tx, task.slotId);
    await tx.task.update({
      where: { id: task.id },
      data: {
        status: 'otkazano',
        cancelReason: input.reason,
        slotId: null,
        statusChangedAt: new Date(),
      },
    });
    await recordEvent(tx, {
      eventType: 'task.cancelled',
      objectType: 'task',
      objectId: task.id,
      taskId: task.id,
      clientId: task.clientId,
      oldValue: { status: task.status },
      newValue: { status: 'otkazano' },
      context: { reason: input.reason },
      narrative: `${ROLE_LABEL[actor.role]} го откажа таскот „${task.title}" (од ${label(task.status)}). Причина: ${input.reason}.`,
    });
    return tx.task.findUnique({ where: { id: task.id } });
  });
}

/** Враќање од пауза (dir/am, G_SLOT_FREE): нов слот, статусот се враќа во pausedFromStatus. */
export async function resumeTask(
  taskId: string,
  input: { newDate: Date; orderInDay?: number },
  actor: { id: string; role: Role },
) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { client: true } });
  if (!task) throw new AppError('NOT_FOUND', 'Таскот не е пронајден.', 404);
  if (!canResumeFromPause(actor.role)) {
    throw new AppError('FORBIDDEN_ROLE', 'Немате дозвола за враќање од пауза.', 403);
  }
  if (task.status !== 'pauza') {
    throw new AppError('VALIDATION_FAILED', 'Таскот не е на пауза.', 400);
  }
  assertNotPast(input.newDate);
  const restore = (task.pausedFromStatus ?? 'mrtov') as DbTaskStatus;

  return prisma.$transaction(async (tx) => {
    const slotId = await acquireSlot(tx, {
      clientId: task.clientId,
      contentType: task.contentType,
      date: input.newDate,
      orderInDay: input.orderInDay ?? 1,
    });
    await tx.task.update({
      where: { id: task.id },
      data: {
        slotId,
        status: restore,
        pausedFromStatus: null,
        pauseReason: null,
        statusChangedAt: new Date(),
      },
    });
    await recordEvent(tx, {
      eventType: 'task.resumed',
      objectType: 'task',
      objectId: task.id,
      taskId: task.id,
      clientId: task.clientId,
      oldValue: { status: 'pauza' },
      newValue: { status: restore, date: ymd(input.newDate) },
      narrative: `${ROLE_LABEL[actor.role]} го врати таскот „${task.title}" од пауза во ${label(restore)} на ${ymd(input.newDate)}.`,
    });
    return tx.task.findUnique({ where: { id: task.id } });
  });
}
