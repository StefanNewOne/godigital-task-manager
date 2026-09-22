import type { ApprovalOutcome, ApprovalType, Client, Prisma, RevisionSource, Task } from '@gd/db';
import type { Role, TransitionPayload } from '@gd/core';
import type { TxClient } from '../../db/tenantExtension.js';
import { parseToken } from './parse.js';

export interface EffectCtx {
  tx: TxClient;
  task: Task & { client: Client };
  payload: TransitionPayload;
  actorId: string;
  actorRole: Role;
}

export interface EffectResult {
  updates: Prisma.TaskUpdateInput;
  autoNext?: string; // системски следен статус (E_AUTO_NEXT) ако условот важи
}

function resolveAssignee(role: string, ctx: EffectCtx): string | null {
  if (ctx.payload.assigneeId) return ctx.payload.assigneeId;
  const map = (ctx.task.client.defaultAssignees ?? {}) as Record<string, string>;
  return map[role] ?? null;
}

/** Изврши ги effects од матрицата (PRD §4.3). Враќа акумулирани измени на таскот. */
export async function runTaskEffects(tokens: string[], ctx: EffectCtx): Promise<EffectResult> {
  const updates: Prisma.TaskUpdateInput = {};
  let autoNext: string | undefined;

  for (const token of tokens) {
    const { name, args } = parseToken(token);
    switch (name) {
      case 'E_ASSIGN': {
        const role = args[0] ?? '';
        const id = resolveAssignee(role, ctx);
        updates.assigneeId = id;
        if (role === 'rez') updates.rezId = id;
        if (role === 'krea') updates.kreaId = id;
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

      // Одложени/друга фаза: E_NOTIFY (B1), E_ALARM (B1), E_SCHEDULE_METRICS (B2),
      // E_STORAGE_TIMER (B3), E_CREATE_EXTRA_SLOTS/E_BIND_SCENARIOS/E_ACTIVATE_CHILDREN (капа, A4).
      default:
        break;
    }
  }

  return { updates, autoNext };
}

export { resolveAssignee };
