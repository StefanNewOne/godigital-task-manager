import type { ClientApprovalInput, InternalTransitionPayload, TaskStatus } from '@gd/core';
import { prisma } from '../../db/tenantExtension.js';
import { AppError } from '../../lib/errors.js';
import { transitionTask } from '../workflow/transition.js';

/**
 * Клиентски одобрувања (Фаза D2). Денес покрива САМО креативи на `kajKlient` (task).
 * CRM понуда/договор одобрување е одложено (види docs/backlog.md) — CRM моторот е owner-gated
 * на sales агентот и нема clientPwa/Approval пат, што е посебен дизајн.
 *
 * Модел (одлука на сопственикот): клиентската одлука го движи ПОСТОЕЧКИОТ преод преку state
 * machine, извршен „во име на" носечката улога (видео→rez, графика→krea). Вистинскиот одобрувач
 * се запишува преку `Approval.source=clientPwa` + `enteredById=clientContactId` (И2 непроменета).
 */

export interface ClientSession {
  contactId: string;
  clientId: string;
}

/** Само client-safe полиња — без интерни наративи/цени/интерни коментари (§9.4). */
const clientSafeTaskSelect = {
  id: true,
  title: true,
  contentType: true,
  version: true,
  status: true,
  slot: { select: { date: true } },
} as const;

type ClientSafeTask = {
  id: string;
  title: string;
  contentType: 'video' | 'graphic';
  version: number;
  status: string;
  publishDate: Date | null;
};

function toClientSafe(t: {
  id: string;
  title: string;
  contentType: string;
  version: number;
  status: string;
  slot: { date: Date } | null;
}): ClientSafeTask {
  return {
    id: t.id,
    title: t.title,
    contentType: t.contentType as 'video' | 'graphic',
    version: t.version,
    status: t.status,
    publishDate: t.slot?.date ?? null,
  };
}

/** Pending креативи што чекаат клиентско одобрување (status=kajKlient) за сесискиот клиент. */
export async function listClientApprovals(session: ClientSession): Promise<ClientSafeTask[]> {
  // tenantId се инјектира од контекст (И1); clientId се ограничува експлицитно (client scope).
  const tasks = await prisma.task.findMany({
    where: { clientId: session.clientId, status: 'kajKlient' },
    select: clientSafeTaskSelect,
    orderBy: { statusChangedAt: 'asc' },
  });
  return tasks.map(toClientSafe);
}

/** Детал на една ставка. 404 ако не постои / не припаѓа на сесискиот клиент (без enumeration). */
export async function getClientApproval(
  session: ClientSession,
  kind: string,
  id: string,
): Promise<ClientSafeTask> {
  if (kind !== 'task') throw new AppError('NOT_FOUND', 'Ставката не е пронајдена.', 404);
  const task = await prisma.task.findUnique({ where: { id }, select: clientSafeTaskSelect });
  // findUnique не е tenant-scoped во extension — проверуваме tenant+client scope рачно.
  const full = await prisma.task.findUnique({
    where: { id },
    select: { clientId: true, tenantId: true, status: true },
  });
  if (!task || !full || full.clientId !== session.clientId) {
    throw new AppError('NOT_FOUND', 'Ставката не е пронајдена.', 404);
  }
  return toClientSafe(task);
}

/**
 * Клиентска одлука → преод преку state machine. approve → kajKlient→zaObjavuvanje;
 * requestChanges → kajKlient→montaza (видео) | dizajn (графика), v+1.
 */
export async function decideClientApproval(
  session: ClientSession,
  kind: string,
  id: string,
  input: ClientApprovalInput,
): Promise<ClientSafeTask> {
  if (kind !== 'task') throw new AppError('NOT_FOUND', 'Ставката не е пронајдена.', 404);

  const task = await prisma.task.findUnique({
    where: { id },
    select: {
      id: true,
      clientId: true,
      contentType: true,
      status: true,
      rezId: true,
      kreaId: true,
      assigneeId: true,
    },
  });
  if (!task || task.clientId !== session.clientId) {
    throw new AppError('NOT_FOUND', 'Ставката не е пронајдена.', 404);
  }
  if (task.status !== 'kajKlient') {
    throw new AppError('TRANSITION_NOT_ALLOWED', 'Ставката веќе не чека одобрување.', 409);
  }

  // Носечка улога по тип (И4): видео→rez, графика→krea. Преодот се извршува „во име на" неа.
  const isVideo = task.contentType === 'video';
  const role = isVideo ? 'rez' : 'krea';
  const ownerId = (isVideo ? task.rezId : task.kreaId) ?? task.assigneeId;
  if (!ownerId) {
    throw new AppError(
      'GUARD_FAILED',
      'Таскот нема доделен сопственик — контактирајте го тимот.',
      409,
    );
  }

  const to: TaskStatus =
    input.outcome === 'approve' ? 'zaObjavuvanje' : isVideo ? 'montaza' : 'dizajn';

  const payload: InternalTransitionPayload = {
    source: 'clientPwa',
    approvalEnteredById: session.contactId,
    ...(input.outcome === 'approve'
      ? { outcome: 'approved' as const }
      : { outcome: 'returned' as const, comment: input.comment }),
  };

  await transitionTask(task.id, to, payload, { id: ownerId, role });

  const updated = await prisma.task.findUnique({
    where: { id: task.id },
    select: clientSafeTaskSelect,
  });
  return toClientSafe(updated!);
}
