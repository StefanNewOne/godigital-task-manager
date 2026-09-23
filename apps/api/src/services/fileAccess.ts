import { PERMISSIONS, ownerOf, type Role } from '@gd/core';
import type { FileOwnerType } from '@gd/db';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';

/**
 * Авторизација за фајлови (CLAUDE.md И4/И7). Секој фајл виси на таск, капа, ревизија, одобрување
 * или коментар; сите се разрешуваат до нивниот таск или капа. Пишување (presign/complete/abort) е
 * дозволено само за: Директор, доделениот на таскот, или улогата што го носи тековниот статус
 * (таск преку `ownerOf`, капа преку `ownsCapaStatuses`). Читање следи `scope` (own гледа само свое).
 * Ако сопственикот не постои → 404 (без enumeration, ист код како туѓ-но-невидлив).
 */
interface Actor {
  sub: string;
  role: Role;
}

type Resolved =
  | {
      kind: 'task';
      task: { id: string; status: string; contentType: string; assigneeId: string | null };
    }
  | {
      kind: 'group';
      group: {
        id: string;
        status: string;
        scenaristId: string | null;
        rezId: string | null;
        kamId: string | null;
      };
    };

const NOT_FOUND = () => new AppError('NOT_FOUND', 'Сопственикот на фајлот не е пронајден.', 404);
const FORBIDDEN = () =>
  new AppError('FORBIDDEN_ROLE', 'Немате дозвола за фајлови на овој објект.', 403);

async function loadTask(taskId: string): Promise<Resolved> {
  const task = await prisma.task.findUnique({
    where: { id: taskId },
    select: { id: true, status: true, contentType: true, assigneeId: true },
  });
  if (!task) throw NOT_FOUND();
  return { kind: 'task', task };
}

async function loadGroup(groupId: string): Promise<Resolved> {
  const group = await prisma.taskGroup.findUnique({
    where: { id: groupId },
    select: { id: true, status: true, scenaristId: true, rezId: true, kamId: true },
  });
  if (!group) throw NOT_FOUND();
  return { kind: 'group', group };
}

/** Разреши го сопственикот (таск/капа/ревизија/одобрување/коментар) до неговиот таск или капа. */
async function resolveOwner(ownerType: FileOwnerType, ownerId: string): Promise<Resolved> {
  switch (ownerType) {
    case 'task':
      return loadTask(ownerId);
    case 'group':
      return loadGroup(ownerId);
    case 'revision': {
      const r = await prisma.revision.findUnique({
        where: { id: ownerId },
        select: { taskId: true },
      });
      if (!r) throw NOT_FOUND();
      return loadTask(r.taskId);
    }
    case 'approval': {
      const a = await prisma.approval.findUnique({
        where: { id: ownerId },
        select: { objectType: true, objectId: true },
      });
      if (!a) throw NOT_FOUND();
      if (a.objectType === 'task') return loadTask(a.objectId);
      if (a.objectType === 'group') return loadGroup(a.objectId);
      // scenario → неговата капа
      const s = await prisma.scenario.findUnique({
        where: { id: a.objectId },
        select: { groupId: true },
      });
      if (!s) throw NOT_FOUND();
      return loadGroup(s.groupId);
    }
    case 'comment': {
      const c = await prisma.comment.findUnique({
        where: { id: ownerId },
        select: { taskId: true, groupId: true },
      });
      if (!c) throw NOT_FOUND();
      return c.taskId ? loadTask(c.taskId) : loadGroup(c.groupId!);
    }
    default:
      throw NOT_FOUND();
  }
}

function canWrite(resolved: Resolved, actor: Actor): boolean {
  if (actor.role === 'dir') return true;
  if (resolved.kind === 'task') {
    const t = resolved.task;
    if (t.assigneeId === actor.sub) return true;
    return ownerOf(t.status as never, t.contentType as never) === actor.role;
  }
  return PERMISSIONS[actor.role].ownsCapaStatuses.includes(resolved.group.status as never);
}

function canRead(resolved: Resolved, actor: Actor): boolean {
  if (PERMISSIONS[actor.role].scope === 'all') return true;
  if (resolved.kind === 'task') return resolved.task.assigneeId === actor.sub;
  const g = resolved.group;
  return g.scenaristId === actor.sub || g.rezId === actor.sub || g.kamId === actor.sub;
}

/** Фрла 404 ако сопственикот не постои, 403 ако актерот нема пристап (read/write). */
export async function assertFileOwnerAccess(
  ownerType: FileOwnerType,
  ownerId: string,
  actor: Actor,
  mode: 'read' | 'write',
): Promise<void> {
  const resolved = await resolveOwner(ownerType, ownerId);
  const ok = mode === 'write' ? canWrite(resolved, actor) : canRead(resolved, actor);
  if (!ok) throw FORBIDDEN();
}
