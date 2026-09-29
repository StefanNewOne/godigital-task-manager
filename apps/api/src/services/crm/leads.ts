import {
  CRM_STALE_DAYS,
  CRM_STATUS_META,
  crmIsStale,
  type CrmLeadCreateInput,
  type CrmMeetingInput,
  type CrmPackageInput,
  type CrmPlanPutInput,
  type CrmTeamInput,
  type Role,
} from '@gd/core';
import type { CalendarType, ContentType, Prisma } from '@gd/db';
import { prisma } from '../../db/tenantExtension.js';
import { AppError } from '../../lib/errors.js';
import { recordEvent } from '../../lib/events.js';
import type { CrmStatus } from '@gd/core';

const withChildren = { offers: true, contracts: true, planEntries: true } as const;

const DAY_MS = 24 * 60 * 60 * 1000;
function staleDays(updatedAt: Date): number {
  return Math.floor((Date.now() - updatedAt.getTime()) / DAY_MS);
}

/** Само сопственикот на лидот дејствува во работната зона (плюс Директор чита сè). */
function assertOwner(agentId: string, actor: { id: string; role: Role }): void {
  if (actor.id !== agentId) {
    throw new AppError(
      'FORBIDDEN_ROLE',
      'Само продажниот агент-сопственик може да го менува лидот.',
      403,
    );
  }
}

/** Видлив опсег: агент → само свои; Директор → сите (опц. филтер по агент). */
function scopeWhere(actor: { id: string; role: Role }, agentId?: string): Prisma.LeadWhereInput {
  if (actor.role === 'sales') return { agentId: actor.id };
  // dir
  return agentId ? { agentId } : {};
}

export interface LeadListFilter {
  /** 'all' | 'waiting' (чека директор) | 'stale' (без промена 5+ дена). */
  filter?: string;
  /** Само за Директор — по агент. */
  agentId?: string;
}

/** Листа лидови за таблата (со деривирана застареност). */
export async function listLeads(actor: { id: string; role: Role }, opts: LeadListFilter = {}) {
  const where = scopeWhere(actor, opts.agentId);
  const leads = await prisma.lead.findMany({ where, orderBy: { updatedAt: 'desc' } });
  const rows = leads.map((l) => {
    const stale = staleDays(l.updatedAt);
    return {
      ...l,
      stale,
      isStale: crmIsStale(l.status as CrmStatus, stale),
      waitDir: CRM_STATUS_META[l.status as CrmStatus].owner === 'dir',
    };
  });
  if (opts.filter === 'waiting') return rows.filter((l) => l.waitDir);
  if (opts.filter === 'stale') return rows.filter((l) => l.isStale);
  return rows;
}

/** Детал на лид (+ верзии, планер, активност). Агент гледа само свој; Директор сите. */
export async function getLead(leadId: string, actor: { id: string; role: Role }) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: withChildren });
  if (!lead) throw new AppError('NOT_FOUND', 'Лидот не е пронајден.', 404);
  if (actor.role === 'sales' && lead.agentId !== actor.id) {
    throw new AppError('NOT_FOUND', 'Лидот не е пронајден.', 404);
  }
  const events = await prisma.eventLog.findMany({
    where: { objectType: 'lead', objectId: leadId },
    orderBy: { occurredAt: 'asc' },
    select: { narrative: true, occurredAt: true, actorRole: true },
  });
  const stale = staleDays(lead.updatedAt);
  return { ...lead, stale, isStale: crmIsStale(lead.status as CrmStatus, stale), events };
}

/** Нов лид. Агент → на себе; Директор → мора `agentId`. */
export async function createLead(input: CrmLeadCreateInput, actor: { id: string; role: Role }) {
  let agentId: string;
  if (actor.role === 'sales') {
    agentId = actor.id;
  } else {
    if (!input.agentId) {
      throw new AppError('GUARD_FAILED', 'Изберете продажен агент за лидот.', 400, {
        missing: ['agent'],
      });
    }
    const agent = await prisma.employee.findFirst({
      where: { id: input.agentId, role: 'sales', active: true },
      select: { id: true },
    });
    if (!agent) throw new AppError('VALIDATION_FAILED', 'Избраниот агент не е валиден.', 400);
    agentId = agent.id;
  }

  return prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        name: input.name.trim(),
        source: input.source,
        person: input.person.trim(),
        phone: input.phone?.trim() || null,
        email: input.email?.trim() || null,
        pkgHint: input.pkgHint?.trim() || '—',
        agentId,
        status: 'novLid',
      },
    });
    await recordEvent(tx, {
      eventType: 'lead.created',
      objectType: 'lead',
      objectId: lead.id,
      narrative:
        actor.role === 'sales'
          ? `Креиран лид „${lead.name}".`
          : `Директорот креираше лид „${lead.name}" и го додели на агент.`,
    });
    return tx.lead.findUnique({ where: { id: lead.id }, include: withChildren });
  });
}

async function loadOwned(leadId: string) {
  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: withChildren });
  if (!lead) throw new AppError('NOT_FOUND', 'Лидот не е пронајден.', 404);
  return lead;
}

/**
 * Прикачи документ. offer/contract → нова интерна верзија; analysis/signed/strategy/fable →
 * поле на лидот; audio → аудио од состанокот. fileId е од presigned R2 (И7).
 */
export async function uploadDoc(
  leadId: string,
  input: { kind: string; fileId?: string },
  actor: { id: string; role: Role },
) {
  const lead = await loadOwned(leadId);
  assertOwner(lead.agentId, actor);
  const fileId = input.fileId ?? null;

  return prisma.$transaction(async (tx) => {
    let narrative = '';
    switch (input.kind) {
      case 'offer': {
        const version = lead.offers.length + 1;
        await tx.leadOffer.create({ data: { leadId, version, fileId } });
        narrative = `Прикачи понуда v${version}.`;
        break;
      }
      case 'contract': {
        const version = lead.contracts.length + 1;
        await tx.leadContract.create({ data: { leadId, version, fileId } });
        narrative = `Прикачи договор v${version}.`;
        break;
      }
      case 'analysis':
        await tx.lead.update({ where: { id: leadId }, data: { analysisFileId: fileId } });
        narrative = 'Прикачи анализа на клиент и конкуренција.';
        break;
      case 'signed':
        await tx.lead.update({ where: { id: leadId }, data: { signedFileId: fileId } });
        narrative = 'Прикачи потпишан договор.';
        break;
      case 'strategy':
        await tx.lead.update({ where: { id: leadId }, data: { strategyFileId: fileId } });
        narrative = 'Прикачи стратегија за 90 дена.';
        break;
      case 'fable':
        await tx.lead.update({ where: { id: leadId }, data: { fableFileId: fileId } });
        narrative = 'Прикачи Fable 5 content планер.';
        break;
      case 'audio':
        await tx.lead.update({ where: { id: leadId }, data: { meetingAudioFileId: fileId } });
        narrative = 'Прикачи аудио од состанокот.';
        break;
      default:
        throw new AppError('VALIDATION_FAILED', 'Непознат тип документ.', 400);
    }
    await recordEvent(tx, {
      eventType: 'lead.docUploaded',
      objectType: 'lead',
      objectId: leadId,
      narrative,
    });
    return tx.lead.findUnique({ where: { id: leadId }, include: withChildren });
  });
}

/** Ажурирај состанок (датум/час/место/одржан/заклучоци). */
export async function updateMeeting(
  leadId: string,
  input: CrmMeetingInput,
  actor: { id: string; role: Role },
) {
  const lead = await loadOwned(leadId);
  assertOwner(lead.agentId, actor);
  const data: Prisma.LeadUpdateInput = {};
  if (input.date !== undefined) data.meetingDate = input.date ?? null;
  if (input.time !== undefined) data.meetingTime = input.time || null;
  if (input.place !== undefined) data.meetingPlace = input.place || null;
  if (input.held !== undefined) data.meetingHeld = input.held;
  if (input.notes !== undefined) data.meetingNotes = input.notes || null;

  return prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: leadId }, data });
    await recordEvent(tx, {
      eventType: 'lead.meetingUpdated',
      objectType: 'lead',
      objectId: leadId,
      narrative: 'Ажуриран состанок.',
    });
    return tx.lead.findUnique({ where: { id: leadId }, include: withChildren });
  });
}

/** Состанокот не се одржа → ресетирај датум/час/потврда за презакажување. */
export async function meetingNoShow(leadId: string, actor: { id: string; role: Role }) {
  const lead = await loadOwned(leadId);
  assertOwner(lead.agentId, actor);
  return prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: leadId },
      data: { meetingDate: null, meetingTime: null, meetingHeld: false },
    });
    await recordEvent(tx, {
      eventType: 'lead.meetingNoShow',
      objectType: 'lead',
      objectId: leadId,
      narrative: 'Клиентот не дојде · состанокот треба да се презакаже.',
    });
    return tx.lead.findUnique({ where: { id: leadId }, include: withChildren });
  });
}

/** Пакет-параметри (чекор 7) — само сопственик. */
export async function updatePackage(
  leadId: string,
  input: CrmPackageInput,
  actor: { id: string; role: Role },
) {
  const lead = await loadOwned(leadId);
  assertOwner(lead.agentId, actor);
  return prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: leadId },
      data: {
        pkgVideos: input.videos,
        pkgGraphics: input.graphics,
        pkgMeta: input.meta,
        pkgStart: input.start ?? null,
        pkgMonths: input.months,
        pkgCalType: input.calType as CalendarType,
      },
    });
    await recordEvent(tx, {
      eventType: 'lead.packageUpdated',
      objectType: 'lead',
      objectId: leadId,
      narrative: 'Ажурирани параметри на пакетот.',
    });
    return tx.lead.findUnique({ where: { id: leadId }, include: withChildren });
  });
}

/** Content планер (чекор 10) — целосна замена на закажаните денови (idempotent). */
export async function setContentPlan(
  leadId: string,
  input: CrmPlanPutInput,
  actor: { id: string; role: Role },
) {
  const lead = await loadOwned(leadId);
  assertOwner(lead.agentId, actor);
  return prisma.$transaction(async (tx) => {
    await tx.contentPlanEntry.deleteMany({ where: { leadId } });
    for (const e of input.entries) {
      await tx.contentPlanEntry.create({
        data: {
          leadId,
          monthKey: e.monthKey,
          day: e.day,
          contentType: e.contentType as ContentType,
        },
      });
    }
    await recordEvent(tx, {
      eventType: 'lead.planUpdated',
      objectType: 'lead',
      objectId: leadId,
      narrative: `Content планерот е ажуриран (${input.entries.length} закажани денови).`,
    });
    return tx.lead.findUnique({ where: { id: leadId }, include: withChildren });
  });
}

/** Стандарден тим — само Директор, само во чекор 11 (aktivacija). */
export async function updateTeam(
  leadId: string,
  input: CrmTeamInput,
  actor: { id: string; role: Role },
) {
  if (actor.role !== 'dir') {
    throw new AppError('FORBIDDEN_ROLE', 'Само Директорот го менува тимот.', 403);
  }
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new AppError('NOT_FOUND', 'Лидот не е пронајден.', 404);
  if (lead.status !== 'aktivacija') {
    throw new AppError('VALIDATION_FAILED', 'Тимот се менува само во чекор Активација.', 400);
  }
  return prisma.$transaction(async (tx) => {
    await tx.lead.update({
      where: { id: leadId },
      data: {
        team: {
          am: input.am ?? null,
          rez: input.rez ?? null,
          krea: input.krea ?? null,
          ana: input.ana ?? null,
        },
      },
    });
    await recordEvent(tx, {
      eventType: 'lead.teamUpdated',
      objectType: 'lead',
      objectId: leadId,
      narrative: 'Директорот го измени стандардниот тим.',
    });
    return tx.lead.findUnique({ where: { id: leadId }, include: withChildren });
  });
}

/** Додели/презадоли лид на друг продажен агент — само Директор, само нетерминален (ADDENDUM §Видливост). */
export async function reassignAgent(
  leadId: string,
  agentId: string,
  actor: { id: string; role: Role },
) {
  if (actor.role !== 'dir') {
    throw new AppError('FORBIDDEN_ROLE', 'Само Директорот доделува лид на агент.', 403);
  }
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new AppError('NOT_FOUND', 'Лидот не е пронајден.', 404);
  if (lead.status === 'aktiviran' || lead.status === 'izguben') {
    throw new AppError('VALIDATION_FAILED', 'Терминален лид не се презадоделува.', 400);
  }
  const agent = await prisma.employee.findFirst({
    where: { id: agentId, role: 'sales', active: true },
    select: { id: true, name: true },
  });
  if (!agent) throw new AppError('VALIDATION_FAILED', 'Избраниот агент не е валиден.', 400);

  return prisma.$transaction(async (tx) => {
    await tx.lead.update({ where: { id: leadId }, data: { agentId: agent.id } });
    await recordEvent(tx, {
      eventType: 'lead.reassigned',
      objectType: 'lead',
      objectId: leadId,
      narrative: `Лидот е доделен на ${agent.name}.`,
    });
    return tx.lead.findUnique({ where: { id: leadId }, include: withChildren });
  });
}

export { CRM_STALE_DAYS };
