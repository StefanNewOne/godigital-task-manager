import {
  crmDefaultTeamRoles,
  crmReactivateTarget,
  type CrmStatus,
  type CrmTransitionPayload,
} from '@gd/core';
import type { Prisma } from '@gd/db';
import type { TxClient } from '../../db/tenantExtension.js';
import type { NotifyInput } from '../notifications.js';
import { parseToken } from '../workflow/parse.js';
import { activateLeadClient } from './activate.js';
import type { LeadWithChildren } from './view.js';

export interface CrmEffectCtx {
  tx: TxClient;
  lead: LeadWithChildren;
  to: CrmStatus;
  payload: CrmTransitionPayload;
  actor: { id: string; role: string };
}

export interface CrmEffectResult {
  leadUpdate: Prisma.LeadUpdateInput;
  notifications: NotifyInput[];
}

/** Последната (најнова) верзија на понуда/договор — за поставување ret/clientRet. */
function latest<T extends { version: number }>(arr: T[]): T | undefined {
  return [...arr].sort((a, b) => a.version - b.version).at(-1);
}

/**
 * Стандарден тим при активација: за секоја потребна улога земи го првиот активен вработен.
 * АМ секогаш · Режисер ако видеа>0 · Гр. креатор ако графики>0 · Аналитичар ако Meta Ads.
 */
async function computeDefaultTeam(
  tx: TxClient,
  lead: LeadWithChildren,
): Promise<Record<string, string | null>> {
  const needed = crmDefaultTeamRoles({
    videos: lead.pkgVideos,
    graphics: lead.pkgGraphics,
    meta: lead.pkgMeta,
  });
  const roles = (['am', 'rez', 'krea', 'ana'] as const).filter((r) => needed[r]);
  const team: Record<string, string | null> = { am: null, rez: null, krea: null, ana: null };
  for (const role of roles) {
    const emp = await tx.employee.findFirst({
      where: { role, active: true },
      orderBy: { createdAt: 'asc' },
      select: { id: true },
    });
    team[role] = emp?.id ?? null;
  }
  return team;
}

/** Изврши ги CRM effects од матрицата (@gd/core `CRM_TRANSITIONS`). */
export async function runCrmEffects(tokens: string[], ctx: CrmEffectCtx): Promise<CrmEffectResult> {
  const leadUpdate: Prisma.LeadUpdateInput = {};
  const notifications: NotifyInput[] = [];
  const { tx, lead, payload } = ctx;
  const comment = payload.comment?.trim() ?? '';

  for (const token of tokens) {
    const { name } = parseToken(token);
    switch (name) {
      case 'E_OFFER_RETURN':
      case 'E_OFFER_CLIENT_RETURN': {
        const last = latest(lead.offers);
        if (last) {
          await tx.leadOffer.update({
            where: { id: last.id },
            data: name === 'E_OFFER_RETURN' ? { ret: comment } : { clientRet: comment },
          });
        }
        break;
      }

      case 'E_CONTRACT_RETURN':
      case 'E_CONTRACT_CLIENT_RETURN': {
        const last = latest(lead.contracts);
        if (last) {
          await tx.leadContract.update({
            where: { id: last.id },
            data: name === 'E_CONTRACT_RETURN' ? { ret: comment } : { clientRet: comment },
          });
        }
        break;
      }

      case 'E_MARK_LOST':
        leadUpdate.lostFromStatus = lead.status;
        leadUpdate.lossReason = payload.lossReason ?? null;
        leadUpdate.lossNote = payload.lossNote?.trim() || null;
        break;

      case 'E_SET_DEFAULT_TEAM':
        if (!lead.team) leadUpdate.team = await computeDefaultTeam(tx, lead);
        break;

      case 'E_ACTIVATE': {
        const clientId = await activateLeadClient(tx, lead);
        leadUpdate.activatedClientId = clientId;
        break;
      }

      case 'E_REACTIVATE': {
        const target = crmReactivateTarget(lead.lostFromStatus as CrmStatus);
        leadUpdate.lostFromStatus = null;
        leadUpdate.lossReason = null;
        leadUpdate.lossNote = null;
        const arr = target === 'ponudaIzr' ? lead.offers : lead.contracts;
        const last = latest(arr);
        if (last && !last.clientRet) {
          const note = 'Реактивиран лид · потребна е нова верзија.';
          if (target === 'ponudaIzr') {
            await tx.leadOffer.update({ where: { id: last.id }, data: { clientRet: note } });
          } else {
            await tx.leadContract.update({ where: { id: last.id }, data: { clientRet: note } });
          }
        }
        break;
      }

      case 'E_NOTIFY': {
        const { args } = parseToken(token);
        if (args[0] === 'dir') {
          const dirs = await tx.employee.findMany({
            where: { role: 'dir', active: true },
            select: { id: true },
          });
          for (const d of dirs) {
            notifications.push({
              recipientId: d.id,
              level: 'potsetnik',
              eventKey: 'crm_awaiting_approval',
              title: 'Чека твое одобрување',
              body: `Лид „${lead.name}" чека одобрување.`,
            });
          }
        } else if (args[0] === 'agent') {
          notifications.push({
            recipientId: lead.agentId,
            level: 'potsetnik',
            eventKey: 'crm_agent_update',
            title: 'Ажурирање на лид',
            body: `Лид „${lead.name}" се придвижи.`,
          });
        }
        break;
      }

      default:
        break;
    }
  }

  return { leadUpdate, notifications };
}
