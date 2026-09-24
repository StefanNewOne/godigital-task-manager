import {
  ROLE_LABEL,
  TASK_STATUS_META,
  findTaskTransition,
  type Role,
  type TaskStatus,
  type TransitionPayload,
} from '@gd/core';
import type { TaskStatus as DbTaskStatus } from '@gd/db';
import { prisma } from '../../db/tenantExtension.js';
import { AppError } from '../../lib/errors.js';
import { recordEvent } from '../../lib/events.js';
import { runTaskGuards, missingMessage } from './guards.js';
import { resolveAssignee, runTaskEffects } from './effects.js';
import { createNotification } from '../notifications.js';

const label = (s: string) => TASK_STATUS_META[s as TaskStatus]?.label ?? s;

/**
 * Извршување на преод на таск преку матрицата (CLAUDE.md И2, PRD §4.3).
 * Една трансакција: провери улога → guards → промени статус → effects → EventLog → Outbox.
 */
export async function transitionTask(
  taskId: string,
  to: TaskStatus,
  payload: TransitionPayload,
  actor: { id: string; role: Role },
) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { client: true } });
  if (!task) throw new AppError('NOT_FOUND', 'Таскот не е пронајден.', 404);

  const rule = findTaskTransition(task.status, to, task.contentType);
  if (!rule) {
    throw new AppError(
      'TRANSITION_NOT_ALLOWED',
      `Преодот „${label(task.status)}" → „${label(to)}" не е во матрицата на дозволени преоди.`,
      400,
    );
  }
  if (rule.actor === 'system') {
    throw new AppError('FORBIDDEN_ROLE', 'Овој преод е системски и не се извршува рачно.', 403);
  }

  const onBehalf = actor.role !== rule.actor;
  if (onBehalf && actor.role !== 'dir') {
    throw new AppError('FORBIDDEN_ROLE', 'Немате дозвола за овој преод.', 403);
  }
  if (onBehalf && !payload.reason?.trim()) {
    // Директор наместо друга улога (D-5) — причина задолжителна.
    throw new AppError('GUARD_FAILED', missingMessage(['reason']), 400, { missing: ['reason'] });
  }

  const { updated, notifications } = await prisma.$transaction(async (tx) => {
    const ctx = { tx, task, to, payload, actorId: actor.id, actorRole: actor.role };

    const g = await runTaskGuards(rule.guards, ctx);
    if (!g.ok) {
      const message =
        g.code === 'SELF_APPROVAL'
          ? 'Не е дозволено самоодобрување — додели друг вработен.'
          : missingMessage(g.missing);
      throw new AppError(g.code, message, 400, { missing: g.missing });
    }

    const eff = await runTaskEffects(rule.effects, ctx);
    await tx.task.update({
      where: { id: task.id },
      data: { ...eff.updates, status: to as DbTaskStatus, statusChangedAt: new Date() },
    });

    let finalStatus: string = to;
    if (eff.autoNext) {
      finalStatus = eff.autoNext;
      await tx.task.update({
        where: { id: task.id },
        data: { status: eff.autoNext as DbTaskStatus, assigneeId: resolveAssignee('ana', ctx) },
      });
    }

    const onBehalfNote = onBehalf ? ` (наместо ${ROLE_LABEL[rule.actor as Role]})` : '';
    await recordEvent(tx, {
      eventType: 'task.transition',
      objectType: 'task',
      objectId: task.id,
      taskId: task.id,
      clientId: task.clientId,
      oldValue: { status: task.status },
      newValue: { status: finalStatus },
      context: onBehalf ? { onBehalfOfRole: rule.actor, reason: payload.reason } : {},
      narrative: `${ROLE_LABEL[actor.role]}${onBehalfNote} го премести таскот „${task.title}" од ${label(task.status)} во ${label(finalStatus)}.`,
    });

    const updated = await tx.task.findUnique({ where: { id: task.id } });
    return { updated, notifications: eff.notifications };
  });

  // Известувања по commit — не смеат да го паднат преодот (best-effort).
  for (const n of notifications) {
    await createNotification(n).catch(() => undefined);
  }
  return updated;
}
