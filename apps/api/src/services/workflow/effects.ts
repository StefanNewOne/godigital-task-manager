import type { ApprovalOutcome, ApprovalType, Client, Prisma, RevisionSource, Task } from '@gd/db';
import { TASK_STATUS_META, type Role, type TaskStatus, type TransitionPayload } from '@gd/core';
import type { TxClient } from '../../db/tenantExtension.js';
import type { NotifyInput } from '../notifications.js';
import { parseToken } from './parse.js';

export interface EffectCtx {
  tx: TxClient;
  task: Task & { client: Client };
  to: TaskStatus;
  payload: TransitionPayload;
  actorId: string;
  actorRole: Role;
}

export interface EffectResult {
  updates: Prisma.TaskUpdateInput;
  autoNext?: string; // системски следен статус (E_AUTO_NEXT) ако условот важи
  notifications: NotifyInput[]; // се испраќаат по commit (не смеат да го паднат преодот)
}

const statusLabel = (s: string) => TASK_STATUS_META[s as TaskStatus]?.label ?? s;

/** Извршител што таскот веќе го носи за дадена улога (rez/krea/mon/diz) — за да се задржи истиот при враќање (TD-8). */
function persistedAssignee(role: string, task: Task): string | null {
  switch (role) {
    case 'rez':
      return task.rezId;
    case 'krea':
      return task.kreaId;
    case 'mon':
      return task.monId;
    case 'diz':
      return task.dizId;
    default:
      return null;
  }
}

function resolveAssignee(role: string, ctx: EffectCtx): string | null {
  // 1) експлицитен избор во payload; 2) веќе доделен извршител (задржи го при враќање);
  // 3) default по клиент. Без (2) враќање без payload/default остава таскот недоделен (TD-8).
  if (ctx.payload.assigneeId) return ctx.payload.assigneeId;
  const persisted = persistedAssignee(role, ctx.task);
  if (persisted) return persisted;
  const map = (ctx.task.client.defaultAssignees ?? {}) as Record<string, string>;
  return map[role] ?? null;
}

/** Изврши ги effects од матрицата (PRD §4.3). Враќа акумулирани измени на таскот. */
export async function runTaskEffects(tokens: string[], ctx: EffectCtx): Promise<EffectResult> {
  const updates: Prisma.TaskUpdateInput = {};
  const notifications: NotifyInput[] = [];
  let autoNext: string | undefined;

  for (const token of tokens) {
    const { name, args } = parseToken(token);
    switch (name) {
      case 'E_ASSIGN': {
        const role = args[0] ?? '';
        const id = resolveAssignee(role, ctx);
        updates.assigneeId = id;
        // Задржи го извршителот по улога за да може да се врати истиот при враќање (TD-8).
        if (role === 'rez') updates.rezId = id;
        if (role === 'krea') updates.kreaId = id;
        if (role === 'mon') updates.monId = id;
        if (role === 'diz') updates.dizId = id;
        break;
      }

      case 'E_VERSION_BUMP':
        updates.version = { increment: 1 };
        break;

      case 'E_REVISION': {
        await ctx.tx.revision.create({
          data: {
            taskId: ctx.task.id,
            version: ctx.task.version + 1,
            returnedById: ctx.actorId,
            role: ctx.actorRole,
            comment: ctx.payload.comment ?? '',
            source: (args[0] as RevisionSource) ?? 'internal',
          },
        });
        break;
      }

      case 'E_APPROVAL': {
        const type = (args[0] as ApprovalType) ?? 'internal';
        const outcome = (args[1] as ApprovalOutcome) ?? ctx.payload.outcome ?? 'approved';
        await ctx.tx.approval.create({
          data: {
            objectType: 'task',
            objectId: ctx.task.id,
            type,
            outcome,
            enteredById: ctx.actorId,
            enteredByRole: ctx.actorRole,
            channel: ctx.payload.channel,
            comment: ctx.payload.comment,
          },
        });
        break;
      }

      case 'E_AUTO_NEXT':
        if (ctx.task.client.usesMetaAds) autoNext = args[0];
        break;

      case 'E_CLOSE_GROUP_IF_FIRST': {
        const group = await ctx.tx.taskGroup.findUnique({ where: { id: ctx.task.groupId } });
        if (group && group.status === 'gPodgotovka') {
          await ctx.tx.taskGroup.update({
            where: { id: group.id },
            data: { status: 'zatvoren', closedAt: new Date() },
          });
        }
        break;
      }

      case 'E_NOTIFY': {
        // E_NOTIFY(nov_task,role) | E_NOTIFY(vraten,role). Известува кого го носи новиот статус.
        const kind = args[0] ?? 'nov_task';
        const role = args[1];
        const recipientId =
          (role ? resolveAssignee(role, ctx) : null) ??
          (typeof updates.assigneeId === 'string' ? updates.assigneeId : ctx.task.assigneeId);
        if (recipientId) {
          const returned = kind === 'vraten';
          notifications.push({
            recipientId,
            level: 'potsetnik',
            eventKey: returned ? 'task_returned' : 'task_new',
            taskId: ctx.task.id,
            clientId: ctx.task.clientId,
            title: returned ? 'Задача вратена' : 'Нова задача за тебе',
            body: `${ctx.task.client.name}: „${ctx.task.title}" — ${statusLabel(ctx.to)}.`,
          });
        }
        break;
      }

      case 'E_ALARM': {
        // E_ALARM(11): 3-то (или повеќе) враќање од клиент → критично до Директор(и).
        if (args[0] === '11') {
          const clientReturns = await ctx.tx.revision.count({
            where: { taskId: ctx.task.id, source: 'client' },
          });
          if (clientReturns >= 3) {
            const dirs = await ctx.tx.employee.findMany({
              where: { role: 'dir', active: true },
              select: { id: true },
            });
            for (const d of dirs) {
              notifications.push({
                recipientId: d.id,
                level: 'kritichen',
                eventKey: 'client_return_3x',
                taskId: ctx.task.id,
                clientId: ctx.task.clientId,
                title: 'Трето враќање од клиент',
                body: `„${ctx.task.title}" (${ctx.task.client.name}) е вратен по ${clientReturns}-ти пат од клиент.`,
              });
            }
          }
        }
        break;
      }

      // Одложени/друга фаза: E_SCHEDULE_METRICS (B2), E_STORAGE_TIMER (B3).
      default:
        break;
    }
  }

  return { updates, autoNext, notifications };
}

export { resolveAssignee };
