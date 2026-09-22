import { guardFail, guardOk, type GuardResult, type Role, type TransitionPayload } from '@gd/core';
import type { Client, FileKind, Task } from '@gd/db';
import type { TxClient } from '../../db/tenantExtension.js';
import { parseToken } from './parse.js';

export interface GuardCtx {
  tx: TxClient;
  task: Task & { client: Client };
  payload: TransitionPayload;
  actorId: string;
  actorRole: Role;
}

/** Изврши ги guards од матрицата (PRD §4.3). Враќа missing[] за градење порака на македонски. */
export async function runTaskGuards(tokens: string[], ctx: GuardCtx): Promise<GuardResult> {
  const missing: string[] = [];

  for (const token of tokens) {
    const { name, args } = parseToken(token);
    switch (name) {
      case 'G_ASSIGNEE_REQUIRED':
        if (!ctx.payload.assigneeId) missing.push('assignee');
        break;

      case 'G_NOT_SELF_APPROVAL':
        if (ctx.payload.assigneeId && ctx.payload.assigneeId === ctx.actorId) {
          return guardFail('SELF_APPROVAL', ['assignee']);
        }
        break;

      case 'G_COMMENT':
        if (!ctx.payload.comment?.trim()) missing.push('comment');
        break;

      case 'G_TEXT': {
        const field = args[0];
        const min = Number(args[1] ?? 1);
        const val =
          field === 'brief'
            ? (ctx.payload.brief ?? ctx.task.brief)
            : (ctx.payload.copy ?? ctx.task.copy);
        if ((val ?? '').trim().length < min) missing.push(field ?? 'text');
        break;
      }

      case 'G_FILE': {
        const kind = args[0] as FileKind;
        const min = Number(args[1] ?? 1);
        const count = await ctx.tx.fileAsset.count({
          where: { ownerType: 'task', ownerId: ctx.task.id, kind },
        });
        if (count < min) missing.push(args[0] ?? 'file');
        break;
      }

      case 'G_PUBLICATION': {
        const count = await ctx.tx.publication.count({
          where: { taskId: ctx.task.id, permalink: { not: null } },
        });
        if (count < 1) missing.push('publication');
        break;
      }

      case 'G_CLIENT_OUTCOME': {
        const allowed = (args[0] ?? '').split('|');
        if (!ctx.payload.outcome || !allowed.includes(ctx.payload.outcome)) missing.push('outcome');
        break;
      }

      case 'G_COMMENT_IF_CHANGES':
        if (ctx.payload.outcome === 'approvedWithChanges' && !ctx.payload.comment?.trim()) {
          missing.push('comment');
        }
        break;

      case 'G_DECISION': {
        const pubs = await ctx.tx.publication.findMany({
          where: { taskId: ctx.task.id },
          select: { id: true },
        });
        const promo = pubs.length
          ? await ctx.tx.promotion.count({
              where: { publicationId: { in: pubs.map((p) => p.id) } },
            })
          : 0;
        if (promo < 1) missing.push('decision');
        break;
      }

      default:
        // G_META_ADS и капа-guards не се блокирачки во таск-engine-от.
        break;
    }
  }

  return missing.length ? guardFail('GUARD_FAILED', missing) : guardOk();
}

const LABELS: Record<string, string> = {
  assignee: 'доделен',
  comment: 'коментар',
  brief: 'брифинг',
  copy: 'копи',
  graphic: 'графика',
  final: 'финално видео',
  raw: 'суров материјал',
  publication: 'објава (копи и линк)',
  outcome: 'исход',
  decision: 'одлука',
  reason: 'причина',
};

/** Македонска порака од missing[] за toast. */
export function missingMessage(missing: string[]): string {
  const parts = missing.map((m) => LABELS[m] ?? m);
  return `Овој преод бара: ${parts.join(', ')}.`;
}
