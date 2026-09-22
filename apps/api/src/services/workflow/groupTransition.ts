import {
  GROUP_STATUS_META,
  ROLE_LABEL,
  findGroupTransition,
  type GroupStatus,
  type Role,
  type TransitionPayload,
} from '@gd/core';
import type { FileKind, Prisma } from '@gd/db';
import { prisma, type TxClient } from '../../db/tenantExtension.js';
import { AppError } from '../../lib/errors.js';
import { recordEvent } from '../../lib/events.js';
import { missingMessage } from './guards.js';
import { parseToken } from './parse.js';

interface GroupCtx {
  tx: TxClient;
  group: Prisma.TaskGroupGetPayload<{ include: { client: true } }>;
  payload: TransitionPayload;
}

const gLabel = (s: string) => GROUP_STATUS_META[s as GroupStatus]?.label ?? s;

async function runGroupGuards(tokens: string[], ctx: GroupCtx): Promise<string[]> {
  const missing: string[] = [];
  const { group, payload, tx } = ctx;
  for (const token of tokens) {
    const { name, args } = parseToken(token);
    switch (name) {
      case 'G_CAPA_FIELDS': {
        if (!(payload.scenaristId ?? group.scenaristId)) missing.push('scenarist');
        if (!(payload.shootDate ?? group.shootDate)) missing.push('shootDate');
        if (!(payload.shootLocation ?? group.shootLocation)) missing.push('shootLocation');
        if (!(payload.scenaristNotes ?? group.scenaristNotes)) missing.push('scenaristNotes');
        break;
      }
      case 'G_COMMENT':
        if (!payload.comment?.trim()) missing.push('comment');
        break;
      case 'G_FILE': {
        const kind = args[0] as FileKind;
        const count = await tx.fileAsset.count({
          where: { ownerType: 'group', ownerId: group.id, kind },
        });
        if (count < 1) missing.push(args[0] ?? 'file');
        break;
      }
      case 'G_SCENARIOS_SPLIT': {
        const count = await tx.scenario.count({ where: { groupId: group.id } });
        if (count < 1) missing.push('scenarios');
        break;
      }
      case 'G_SCENARIO_OUTCOMES': {
        const pending = await tx.scenario.count({
          where: { groupId: group.id, status: 'predlozeno' },
        });
        if (pending > 0) missing.push('scenarioOutcomes');
        break;
      }
      case 'G_AT_LEAST_ONE_APPROVED': {
        const approved = await tx.scenario.count({
          where: { groupId: group.id, status: { in: ['odobreno', 'odobrenoSoIzmeni'] } },
        });
        if (approved < 1) missing.push('approvedScenario');
        break;
      }
      case 'G_FIRST_CHILD_IN_BRIFING': {
        const inBrifing = await tx.task.count({ where: { groupId: group.id, status: 'brifing' } });
        if (inBrifing < 1) missing.push('firstChild');
        break;
      }
      default:
        break;
    }
  }
  return missing;
}

/** Активација на видео деца (D-1/D-2): врзи одобрени сценарија, датумите ОСТАНУВААТ. */
async function activateVideoChildren(ctx: GroupCtx): Promise<number> {
  const { tx, group } = ctx;
  const approved = await tx.scenario.findMany({
    where: { groupId: group.id, status: { in: ['odobreno', 'odobrenoSoIzmeni'] } },
    orderBy: { ordinal: 'asc' },
  });
  const children = await tx.task.findMany({
    where: { groupId: group.id, status: 'mrtov' },
    orderBy: { slot: { date: 'asc' } },
  });
  const n = Math.min(approved.length, children.length);
  for (let i = 0; i < n; i++) {
    await tx.task.update({
      where: { id: children[i]!.id },
      data: {
        scenarioId: approved[i]!.id,
        status: 'cekaSnimanje',
        rezId: group.rezId,
        assigneeId: group.kamId,
      },
    });
  }
  // Записи за одобрување по сценарио.
  for (const s of approved) {
    await tx.approval.create({
      data: {
        objectType: 'scenario',
        objectId: s.id,
        type: 'client',
        outcome: s.status === 'odobrenoSoIzmeni' ? 'approvedWithChanges' : 'approved',
        source: 'employee',
      },
    });
  }
  return n; // ако approved != children → аларм 9 (B1); засега само наратив
}

/**
 * Преод на капа таск (PRD §4.3 капа матрица). Една трансакција: улога → guards →
 * статус + effects (вклучувајќи активација на деца, D-1/D-2) → EventLog.
 */
export async function transitionTaskGroup(
  groupId: string,
  to: GroupStatus,
  payload: TransitionPayload,
  actor: { id: string; role: Role },
) {
  const group = await prisma.taskGroup.findUnique({
    where: { id: groupId },
    include: { client: true },
  });
  if (!group) throw new AppError('NOT_FOUND', 'Капа таскот не е пронајден.', 404);

  const rule = findGroupTransition(group.status as GroupStatus, to, group.contentType);
  if (!rule) {
    throw new AppError(
      'TRANSITION_NOT_ALLOWED',
      `Преодот „${gLabel(group.status)}" → „${gLabel(to)}" не е дозволен.`,
      400,
    );
  }

  const systemRule = rule.actor === 'system';
  const allowed = systemRule
    ? actor.role === 'dir' || actor.role === 'kam'
    : actor.role === rule.actor || actor.role === 'dir';
  if (!allowed) throw new AppError('FORBIDDEN_ROLE', 'Немате дозвола за овој преод.', 403);

  const defaults = (group.client.defaultAssignees ?? {}) as Record<string, string>;

  return prisma.$transaction(async (tx) => {
    const ctx: GroupCtx = { tx, group, payload };
    const missing = await runGroupGuards(rule.guards, ctx);
    if (missing.length) {
      throw new AppError('GUARD_FAILED', missingMessage(missing), 400, { missing });
    }

    const upd: Prisma.TaskGroupUpdateInput = { status: to };
    let activated = 0;

    for (const token of rule.effects) {
      const { name, args } = parseToken(token);
      switch (name) {
        case 'E_ASSIGN': {
          const role = args[0];
          if (role === 'scen') upd.scenaristId = payload.scenaristId ?? defaults.scen ?? null;
          if (role === 'kam') upd.kamId = payload.kamId ?? defaults.kam ?? null;
          if (role === 'rez') upd.rezId = group.rezId ?? defaults.rez ?? actor.id;
          break;
        }
        case 'E_VERSION_BUMP':
          upd.scenarioDocVersion = { increment: 1 };
          break;
        case 'E_ACTIVATE_CHILDREN': {
          if (args[0] === 'cekaSnimanje') {
            activated = await activateVideoChildren(ctx);
          } else if (args[0] === 'chekaRezija') {
            const kids = await tx.task.findMany({
              where: { groupId: group.id, status: 'cekaSnimanje' },
            });
            for (const k of kids) {
              await tx.task.update({
                where: { id: k.id },
                data: { status: 'chekaRezija', assigneeId: group.rezId },
              });
            }
            activated = kids.length;
          }
          break;
        }
        case 'E_CLOSE_GROUP':
          upd.closedAt = new Date();
          break;
        case 'E_STORAGE_TIMER': {
          const del = new Date();
          del.setUTCDate(del.getUTCDate() + 7);
          upd.rawDeleteAt = del;
          break;
        }
        // E_BIND_SCENARIOS (во activateVideoChildren), E_APPROVAL (исто),
        // E_REVISION/E_CREATE_EXTRA_SLOTS/E_ALARM/E_NOTIFY — B/подоцна.
        default:
          break;
      }
    }

    // Капа полиња од payload (podgotovka → scenarija).
    if (payload.scenaristId !== undefined) upd.scenaristId = payload.scenaristId;
    if (payload.shootDate !== undefined) upd.shootDate = payload.shootDate;
    if (payload.shootLocation !== undefined) upd.shootLocation = payload.shootLocation;
    if (payload.scenaristNotes !== undefined) upd.scenaristNotes = payload.scenaristNotes;

    await tx.taskGroup.update({ where: { id: group.id }, data: upd });

    await recordEvent(tx, {
      eventType: 'taskGroup.transition',
      objectType: 'group',
      objectId: group.id,
      groupId: group.id,
      clientId: group.clientId,
      oldValue: { status: group.status },
      newValue: { status: to, activated },
      narrative: `${ROLE_LABEL[actor.role]} ја премести капата „${group.client.name} · ${group.monthKey}" од ${gLabel(group.status)} во ${gLabel(to)}${activated ? ` (активирани ${activated} деца)` : ''}.`,
    });

    return tx.taskGroup.findUnique({ where: { id: group.id } });
  });
}
