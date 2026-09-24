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
import { createNotification, type NotifyInput } from '../notifications.js';
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

function extraTitle(clientName: string, date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${clientName} · Видео · ${dd}.${mm}`;
}

/**
 * Најди наредна слободна дата за екстра слот: следен видео-ден (по календар) после `after`
 * што нема веќе слот на orderInDay=1. Детерминистички, ограничен на 400 дена.
 */
async function nextExtraSlotDate(
  tx: TxClient,
  clientId: string,
  weekdays: Set<number>,
  after: Date,
): Promise<Date> {
  const d = new Date(Date.UTC(after.getUTCFullYear(), after.getUTCMonth(), after.getUTCDate()));
  for (let i = 0; i < 400; i++) {
    d.setUTCDate(d.getUTCDate() + 1);
    const iso = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (!weekdays.has(iso)) continue;
    const exists = await tx.publishingSlot.findFirst({
      where: { clientId, contentType: 'video', date: new Date(d), orderInDay: 1 },
    });
    if (!exists) return new Date(d);
  }
  throw new AppError('VALIDATION_FAILED', 'Нема слободна дата за екстра сценарио.', 400);
}

/**
 * Активација на видео деца (D-1/D-2): врзи одобрени сценарија, датумите ОСТАНУВААТ.
 * E_CREATE_EXTRA_SLOTS: ако одобрените сценарија се повеќе од резервираните слотови,
 * за секое вишок сценарио се создава нов резервиран слот + екстра таск (isExtra).
 */
async function activateVideoChildren(ctx: GroupCtx): Promise<{ activated: number; extra: number }> {
  const { tx, group } = ctx;
  const approved = await tx.scenario.findMany({
    where: { groupId: group.id, status: { in: ['odobreno', 'odobrenoSoIzmeni'] } },
    orderBy: { ordinal: 'asc' },
  });
  const children = await tx.task.findMany({
    where: { groupId: group.id, status: 'mrtov' },
    orderBy: { slot: { date: 'asc' } },
    include: { slot: true },
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

  // E_CREATE_EXTRA_SLOTS: вишок одобрени сценарија → екстра слотови + таскови.
  let extra = 0;
  if (approved.length > children.length) {
    const config = await tx.calendarConfig.findFirst({
      where: { clientId: group.clientId, contentType: 'video' },
    });
    const weekdays = new Set<number>(config?.weekdays.length ? config.weekdays : [2, 5]);
    let cursor = children[children.length - 1]?.slot?.date ?? group.shootDate ?? new Date();
    for (let i = children.length; i < approved.length; i++) {
      const date = await nextExtraSlotDate(tx, group.clientId, weekdays, cursor);
      cursor = date;
      const monthKey = `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
      const slot = await tx.publishingSlot.create({
        data: {
          clientId: group.clientId,
          contentType: 'video',
          date,
          orderInDay: 1,
          status: 'reserved',
          monthKey,
        },
      });
      await tx.task.create({
        data: {
          groupId: group.id,
          clientId: group.clientId,
          contentType: 'video',
          title: extraTitle(group.client.name, date),
          titleIsAuto: true,
          status: 'cekaSnimanje',
          isExtra: true,
          scenarioId: approved[i]!.id,
          slotId: slot.id,
          rezId: group.rezId,
          assigneeId: group.kamId,
        },
      });
      extra++;
    }
  }

  return { activated: n, extra };
}

/**
 * Bulk активација на графичка капа (D-3): сите мртви деца → brifing, доделени на креатор;
 * капата се затвора (gPodgotovka → zatvoren). Датумите остануваат (D-2).
 */
export async function bulkActivateGraphic(groupId: string, actor: { id: string; role: Role }) {
  const group = await prisma.taskGroup.findUnique({
    where: { id: groupId },
    include: { client: true },
  });
  if (!group) throw new AppError('NOT_FOUND', 'Капа таскот не е пронајден.', 404);
  if (group.contentType !== 'graphic') {
    throw new AppError('VALIDATION_FAILED', 'Bulk активација е само за графика.', 400);
  }
  if (actor.role !== 'krea' && actor.role !== 'dir') {
    throw new AppError('FORBIDDEN_ROLE', 'Само Гр. креатор може да активира слотови.', 403);
  }
  const defaults = (group.client.defaultAssignees ?? {}) as Record<string, string>;
  const kreaId = actor.role === 'krea' ? actor.id : (defaults.krea ?? null);

  return prisma.$transaction(async (tx) => {
    const children = await tx.task.findMany({ where: { groupId, status: 'mrtov' } });
    for (const c of children) {
      await tx.task.update({
        where: { id: c.id },
        data: { status: 'brifing', assigneeId: kreaId, kreaId },
      });
    }
    if (group.status === 'gPodgotovka') {
      await tx.taskGroup.update({
        where: { id: group.id },
        data: { status: 'zatvoren', closedAt: new Date() },
      });
    }
    await recordEvent(tx, {
      eventType: 'taskGroup.bulkActivated',
      objectType: 'group',
      objectId: group.id,
      groupId: group.id,
      clientId: group.clientId,
      newValue: { activated: children.length },
      narrative: `${ROLE_LABEL[actor.role]} активираше ${children.length} графички слотови за „${group.client.name} · ${group.monthKey}".`,
    });
    return { activated: children.length };
  });
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

  // D-5: Директор наместо носителот на капа-статусот — причина задолжителна (како кај таск-преоди).
  const onBehalf = !systemRule && actor.role !== rule.actor;
  if (onBehalf && !payload.reason?.trim()) {
    throw new AppError('GUARD_FAILED', missingMessage(['reason']), 400, { missing: ['reason'] });
  }

  const defaults = (group.client.defaultAssignees ?? {}) as Record<string, string>;

  const { group: updatedGroup, notifications } = await prisma.$transaction(async (tx) => {
    const ctx: GroupCtx = { tx, group, payload };
    const missing = await runGroupGuards(rule.guards, ctx);
    if (missing.length) {
      throw new AppError('GUARD_FAILED', missingMessage(missing), 400, { missing });
    }

    const upd: Prisma.TaskGroupUpdateInput = { status: to };
    const notify: NotifyInput[] = [];
    let activated = 0;
    let extra = 0;

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
        case 'E_NOTIFY': {
          // Известува кого го носи новиот капа-статус (сценарист/режисер).
          const role = args[1] ?? 'rez';
          const recipientId =
            role === 'scen'
              ? (payload.scenaristId ?? defaults.scen ?? group.scenaristId)
              : role === 'kam'
                ? (payload.kamId ?? defaults.kam ?? group.kamId)
                : (group.rezId ?? defaults.rez ?? null);
          if (recipientId) {
            notify.push({
              recipientId,
              level: 'potsetnik',
              eventKey: 'capa_new',
              groupId: group.id,
              clientId: group.clientId,
              title: 'Нова капа задача',
              body: `${group.client.name}: капата е во „${gLabel(to)}".`,
            });
          }
          break;
        }
        case 'E_ALARM': {
          // E_ALARM(9): одобрени сценарија > резервирани слотови → критично до Директор(и).
          if (args[0] === '9' && extra > 0) {
            const dirs = await tx.employee.findMany({
              where: { role: 'dir', active: true },
              select: { id: true },
            });
            for (const d of dirs) {
              notify.push({
                recipientId: d.id,
                level: 'kritichen',
                eventKey: 'scenario_slot_mismatch',
                groupId: group.id,
                clientId: group.clientId,
                title: 'Повеќе сценарија од слотови',
                body: `${group.client.name}: создадени ${extra} екстра слот(ови) за вишок одобрени сценарија.`,
              });
            }
          }
          break;
        }
        case 'E_VERSION_BUMP':
          upd.scenarioDocVersion = { increment: 1 };
          break;
        case 'E_ACTIVATE_CHILDREN': {
          if (args[0] === 'cekaSnimanje') {
            const res = await activateVideoChildren(ctx);
            activated = res.activated;
            extra = res.extra;
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

    const onBehalfNote = onBehalf ? ` (наместо ${ROLE_LABEL[rule.actor as Role]})` : '';
    await recordEvent(tx, {
      eventType: 'taskGroup.transition',
      objectType: 'group',
      objectId: group.id,
      groupId: group.id,
      clientId: group.clientId,
      oldValue: { status: group.status },
      newValue: { status: to, activated, extra },
      context: onBehalf ? { onBehalfOfRole: rule.actor, reason: payload.reason } : {},
      narrative: `${ROLE_LABEL[actor.role]}${onBehalfNote} ја премести капата „${group.client.name} · ${group.monthKey}" од ${gLabel(group.status)} во ${gLabel(to)}${activated ? ` (активирани ${activated} деца${extra ? `, +${extra} екстра` : ''})` : ''}.`,
    });

    const result = await tx.taskGroup.findUnique({ where: { id: group.id } });
    return { group: result, notifications: notify };
  });

  // Известувања по commit (best-effort — не смеат да го паднат преодот).
  for (const n of notifications) {
    await createNotification(n).catch(() => undefined);
  }
  return updatedGroup;
}
