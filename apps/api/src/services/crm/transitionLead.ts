import {
  CRM_STATUS_META,
  ROLE_LABEL,
  crmMissing,
  crmReactivateTarget,
  findCrmTransition,
  type CrmStatus,
  type CrmTransitionPayload,
  type Role,
} from '@gd/core';
import type { LeadStatus } from '@gd/db';
import { prisma } from '../../db/tenantExtension.js';
import { AppError } from '../../lib/errors.js';
import { recordEvent } from '../../lib/events.js';
import { createNotification } from '../notifications.js';
import { runCrmEffects } from './effects.js';
import { toLeadView, type LeadWithChildren } from './view.js';

const label = (s: CrmStatus) => CRM_STATUS_META[s].label;

const withChildren = { offers: true, contracts: true, planEntries: true } as const;

/** Наратив за EventLog — верен на логовите од прототипот (со верзија каде треба). */
function buildNarrative(
  lead: LeadWithChildren,
  from: CrmStatus,
  to: CrmStatus,
  kind: string,
  payload: CrmTransitionPayload,
  actorRole: Role,
): string {
  const isOfferCtx = from.startsWith('ponuda') || to.startsWith('ponuda');
  const vnum = isOfferCtx ? lead.offers.length : lead.contracts.length;
  const rule = findCrmTransition(from, to);
  let text = (rule?.note ?? `${label(from)} → ${label(to)}`).replace('vN', `v${vnum}`);
  if (kind === 'lose' && payload.lossReason) text = `Изгубен лид · ${payload.lossReason}.`;
  return `${ROLE_LABEL[actorRole]}: ${text} (лид „${lead.name}").`;
}

/** Порака за guard-fail на македонски (верна на flash-евите во прототипот). */
function guardMessage(missing: string[]): string {
  if (missing.includes('__comment')) return 'Коментарот е задолжителен.';
  if (missing.includes('__reason')) return 'Избери причина.';
  if (missing.includes('__note')) return 'За „Друго" опиши ја причината.';
  return `Недостасува: ${missing.join(', ')}.`;
}

/**
 * Извршување на преод на лид преку матрицата (@gd/core `CRM_TRANSITIONS`, CLAUDE.md И2).
 * Една трансакција: сопственост → guards → промени статус → effects → EventLog → Outbox.
 * Сопственоста (ADDENDUM): агент-чекор → само лид-сопственикот; директор-чекор → само Директор;
 * реактивација → сопственикот или Директор.
 */
export async function transitionLead(
  leadId: string,
  to: CrmStatus,
  payload: CrmTransitionPayload,
  actor: { id: string; role: Role },
) {
  const lead = (await prisma.lead.findUnique({
    where: { id: leadId },
    include: withChildren,
  })) as LeadWithChildren | null;
  if (!lead) throw new AppError('NOT_FOUND', 'Лидот не е пронајден.', 404);

  const from = lead.status as CrmStatus;
  // Од изгубен: целта ја одредува чекорот од кој паднал (реактивација).
  const target =
    from === 'izguben'
      ? crmReactivateTarget((lead.lostFromStatus as CrmStatus) ?? 'ponudaKlient')
      : to;

  const rule = findCrmTransition(from, target);
  if (!rule) {
    throw new AppError(
      'TRANSITION_NOT_ALLOWED',
      `Преодот „${label(from)}" → „${label(target)}" не е дозволен.`,
      400,
    );
  }

  // Сопственост.
  if (rule.actor === 'dir') {
    if (actor.role !== 'dir') {
      throw new AppError('FORBIDDEN_ROLE', 'Овој чекор го одобрува Директорот.', 403);
    }
  } else if (rule.kind === 'reactivate') {
    if (actor.id !== lead.agentId && actor.role !== 'dir') {
      throw new AppError(
        'FORBIDDEN_ROLE',
        'Само сопственикот или Директорот може да реактивира.',
        403,
      );
    }
  } else if (actor.id !== lead.agentId) {
    throw new AppError(
      'FORBIDDEN_ROLE',
      'Само продажниот агент-сопственик може да дејствува.',
      403,
    );
  }

  const view = toLeadView(lead);

  const { updated, notifications } = await prisma.$transaction(async (tx) => {
    // Guards.
    const missing: string[] = [];
    if (rule.kind === 'forward') missing.push(...crmMissing(view));
    if (rule.guards.includes('G_COMMENT') && !payload.comment?.trim()) missing.push('__comment');
    if (rule.guards.includes('G_LOSS_REASON')) {
      if (!payload.lossReason) missing.push('__reason');
      else if (payload.lossReason === 'Друго' && !payload.lossNote?.trim()) missing.push('__note');
    }
    if (missing.length) {
      const clean = missing.filter((m) => !m.startsWith('__'));
      throw new AppError('GUARD_FAILED', guardMessage(missing), 400, { missing: clean });
    }

    const eff = await runCrmEffects(rule.effects, { tx, lead, to: target, payload, actor });

    await tx.lead.update({
      where: { id: lead.id },
      data: { ...eff.leadUpdate, status: target as LeadStatus },
    });

    await recordEvent(tx, {
      eventType: 'lead.transition',
      objectType: 'lead',
      objectId: lead.id,
      clientId: (eff.leadUpdate.activatedClientId as string | undefined) ?? lead.activatedClientId,
      oldValue: { status: from },
      newValue: { status: target },
      narrative: buildNarrative(lead, from, target, rule.kind, payload, actor.role),
    });

    const updated = await tx.lead.findUnique({ where: { id: lead.id }, include: withChildren });
    return { updated, notifications: eff.notifications };
  });

  // Известувања по commit (best-effort — не смеат да го паднат преодот).
  for (const n of notifications) {
    await createNotification(n).catch(() => undefined);
  }
  return updated;
}
