import {
  buildPlanPreview,
  findPlanTransition,
  isPlanVerifiable,
  opMeta,
  type OpCode,
  type PlanStatus,
} from '@gd/core';
import type { MetaPlanOp, MetaPlanStatus, MetaPlanVia, Prisma } from '@gd/db';
import { prisma } from '../../db/tenantExtension.js';
import { ctx } from '../../db/context.js';
import { AppError } from '../../lib/errors.js';
import { recordEvent } from '../../lib/events.js';

/**
 * Модул 3 · Мета — М5: планови за промена (§12) + архива. Планот НЕ извршува ништо (D1):
 * човек ја прави промената рачно во Ads Manager, а `meta.structure` sync-от ја потврдува.
 * Секој преод е трансакција: провери матрица (packages/core) → смени статус → EventLog + Outbox.
 */

interface PlanTarget {
  campaignId?: string;
  adSetId?: string;
  adId?: string;
}

function actor(): { id: string; role: string } {
  const c = ctx();
  if (!c.actorId || !c.actorRole) throw new AppError('FORBIDDEN_ROLE', 'Недостасува актер.', 403);
  return { id: c.actorId, role: c.actorRole };
}

/** Врати го огледалниот објект (campaign/adSet/ad) што го таргетира планот. */
async function resolveMirror(
  tx: Prisma.TransactionClient | typeof prisma,
  target: PlanTarget,
): Promise<{
  before: Record<string, unknown>;
  learning: boolean;
} | null> {
  if (target.campaignId) {
    const c = await tx.metaCampaign.findUnique({ where: { metaId: target.campaignId } });
    if (!c) return null;
    return {
      before: {
        status: c.status,
        effectiveStatus: c.effectiveStatus,
        dailyBudget: c.dailyBudget ? Number(c.dailyBudget) : null,
        name: c.name,
        stopTime: c.stopTime,
        pausedExternally: c.pausedExternally,
      },
      learning: false,
    };
  }
  if (target.adSetId) {
    const s = await tx.metaAdSet.findUnique({ where: { metaId: target.adSetId } });
    if (!s) return null;
    return {
      before: { status: s.status, effectiveStatus: s.effectiveStatus, name: s.name },
      learning: s.learningStage === 'LIMITED' || s.learningStage === 'LEARNING',
    };
  }
  if (target.adId) {
    const a = await tx.metaAd.findUnique({ where: { metaId: target.adId } });
    if (!a) return null;
    return {
      before: { status: a.status, effectiveStatus: a.effectiveStatus, name: a.name },
      learning: false,
    };
  }
  return { before: {}, learning: false };
}

export interface CreatePlanInput {
  clientId: string;
  op: OpCode;
  target: PlanTarget;
  params?: Record<string, unknown>;
  note?: string;
  taskId?: string;
  promotionId?: string;
  via?: MetaPlanVia;
  command?: string;
  idempotencyKey?: string;
}

export interface PlanPreviewResult {
  before: Record<string, unknown>;
  after: Record<string, unknown> | null;
  consequences: string[];
  warnings: string[];
  /** Дали рекламната сметка е само за читање (тогаш планот не смее да се создаде — §11). */
  accountReadOnly: boolean;
}

/**
 * Пресметај preview на план (before/after/последици/предупредувања) БЕЗ да создадеш `MetaChangePlan`.
 * Го користат `createPlan` и AI помошникот (`draft_plan`, §11).
 */
export async function previewPlan(input: {
  clientId: string;
  op: OpCode;
  target: PlanTarget;
  params?: Record<string, unknown>;
}): Promise<PlanPreviewResult> {
  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);
  const mirror = (await resolveMirror(prisma, input.target)) ?? { before: {}, learning: false };
  const preview = buildPlanPreview({
    op: input.op,
    params: input.params,
    before: mirror.before,
    client: {
      metaMaxDailyBudget: client.metaMaxDailyBudget ? Number(client.metaMaxDailyBudget) : null,
      metaNamingConvention: client.metaNamingConvention,
    },
    learning: mirror.learning,
  });
  const adAccount = await prisma.metaConnection.findFirst({
    where: { clientId: input.clientId, kind: 'adAccount' },
  });
  return {
    before: mirror.before,
    after: preview.after,
    consequences: preview.consequences,
    warnings: preview.warnings,
    accountReadOnly: adAccount?.accessLevel === 'read',
  };
}

/** Создај план. dir → веднаш `approved`; ana → `pending`. */
export async function createPlan(input: CreatePlanInput) {
  const a = actor();
  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);

  const mirror = (await resolveMirror(prisma, input.target)) ?? { before: {}, learning: false };
  const preview = buildPlanPreview({
    op: input.op,
    params: input.params,
    before: mirror.before,
    client: {
      metaMaxDailyBudget: client.metaMaxDailyBudget ? Number(client.metaMaxDailyBudget) : null,
      metaNamingConvention: client.metaNamingConvention,
    },
    learning: mirror.learning,
  });

  const status: PlanStatus = a.role === 'dir' ? 'approved' : 'pending';

  return prisma.$transaction(async (tx) => {
    const plan = await tx.metaChangePlan.create({
      data: {
        clientId: input.clientId,
        op: input.op as MetaPlanOp,
        target: input.target as Prisma.InputJsonValue,
        params: (input.params ?? {}) as Prisma.InputJsonValue,
        before: mirror.before as Prisma.InputJsonValue,
        after: (preview.after ?? undefined) as Prisma.InputJsonValue | undefined,
        consequences: preview.consequences,
        warnings: preview.warnings,
        status: status as MetaPlanStatus,
        createdById: a.id,
        createdVia: input.via ?? 'manual',
        command: input.command ?? null,
        note: input.note ?? null,
        taskId: input.taskId ?? null,
        promotionId: input.promotionId ?? null,
        approvedById: status === 'approved' ? a.id : null,
        approvedAt: status === 'approved' ? new Date() : null,
        idempotencyKey: input.idempotencyKey ?? null,
      },
    });
    await recordEvent(tx, {
      eventType: 'meta.plan.created',
      objectType: 'meta_plan',
      objectId: plan.id,
      clientId: input.clientId,
      taskId: input.taskId ?? null,
      newValue: { op: input.op, status, after: preview.after ?? null } as Prisma.InputJsonValue,
      narrative: `Создаден план „${opMeta(input.op).label}" (${status === 'approved' ? 'одобрен' : 'на чекање'}).`,
    });
    return plan;
  });
}

/** Заеднички: изврши преод на план со проверка на матрицата (core) + EventLog. */
async function transitionPlan(
  id: string,
  to: PlanStatus,
  opts: { note?: string; eventType: string; narrative: (label: string) => string },
) {
  const a = actor();
  return prisma.$transaction(async (tx) => {
    const plan = await tx.metaChangePlan.findUnique({ where: { id } });
    if (!plan) throw new AppError('NOT_FOUND', 'Планот не е пронајден.', 404);

    const from = plan.status as PlanStatus;
    const t = findPlanTransition(from, to);
    if (!t) {
      throw new AppError('TRANSITION_NOT_ALLOWED', `Преод ${from} → ${to} не е дозволен.`, 409);
    }
    if (t.requiresNote && !opts.note?.trim()) {
      throw new AppError('COMMENT_REQUIRED', 'Оваа акција бара белешка.', 422);
    }
    if (t.ownerOnly && plan.createdById !== a.id) {
      throw new AppError('FORBIDDEN_ROLE', 'Само сопственикот може да го повлече планот.', 403);
    }

    const data: Prisma.MetaChangePlanUpdateInput = { status: to as MetaPlanStatus };
    if (to === 'approved') {
      data.approvedById = a.id;
      data.approvedAt = new Date();
    }
    if (to === 'rejected') data.rejectNote = opts.note ?? null;
    if (to === 'syncing') data.markedDoneAt = new Date();

    const updated = await tx.metaChangePlan.update({ where: { id }, data });
    await recordEvent(tx, {
      eventType: opts.eventType,
      objectType: 'meta_plan',
      objectId: id,
      clientId: plan.clientId,
      taskId: plan.taskId,
      oldValue: { status: from },
      newValue: { status: to },
      context: opts.note ? { note: opts.note } : undefined,
      narrative: opts.narrative(opMeta(plan.op as OpCode).label),
    });
    return updated;
  });
}

export const approvePlan = (id: string) =>
  transitionPlan(id, 'approved', {
    eventType: 'meta.plan.approved',
    narrative: (l) => `Одобрен план „${l}".`,
  });

export const rejectPlan = (id: string, note: string) =>
  transitionPlan(id, 'rejected', {
    note,
    eventType: 'meta.plan.rejected',
    narrative: (l) => `Одбиен план „${l}".`,
  });

export const markPlanDone = (id: string) =>
  transitionPlan(id, 'syncing', {
    eventType: 'meta.plan.marked_done',
    narrative: (l) => `Означено „Направено во Ads Manager" за „${l}".`,
  });

export const withdrawPlan = (id: string) =>
  transitionPlan(id, 'withdrawn', {
    eventType: 'meta.plan.withdrawn',
    narrative: (l) => `Повлечен план „${l}".`,
  });

/** Листа планови. `ana` гледа само свои (§8). */
export async function listPlans(opts: { clientId?: string; status?: string }) {
  const a = actor();
  const where: Prisma.MetaChangePlanWhereInput = {};
  if (opts.clientId) where.clientId = opts.clientId;
  if (opts.status) where.status = opts.status as MetaPlanStatus;
  if (a.role === 'ana') where.createdById = a.id;
  return prisma.metaChangePlan.findMany({ where, orderBy: [{ createdAt: 'desc' }], take: 200 });
}

/**
 * Архива = append-only `EventLog` за сите `meta.*` настани (§4.7). Филтер по клиент + датумски опсег.
 */
export async function listArchive(opts: { clientId?: string; from?: string; to?: string }) {
  const where: Prisma.EventLogWhereInput = { eventType: { startsWith: 'meta.' } };
  if (opts.clientId) where.clientId = opts.clientId;
  if (opts.from || opts.to) {
    where.occurredAt = {};
    if (opts.from) (where.occurredAt as Prisma.DateTimeFilter).gte = new Date(opts.from);
    if (opts.to) (where.occurredAt as Prisma.DateTimeFilter).lte = new Date(opts.to);
  }
  return prisma.eventLog.findMany({
    where,
    orderBy: [{ occurredAt: 'desc' }],
    take: 1000,
    select: {
      id: true,
      eventType: true,
      narrative: true,
      actorRole: true,
      clientId: true,
      objectType: true,
      objectId: true,
      occurredAt: true,
    },
  });
}

/** CSV извоз на архивата (за Директор). Без PII во полињата — само наратив + мета. */
export async function archiveCsv(opts: { clientId?: string; from?: string; to?: string }) {
  const rows = await listArchive(opts);
  const header = 'datum;tip;uloga;naracija';
  const escape = (s: string) => `"${s.replace(/"/g, '""')}"`;
  const lines = rows.map((r) =>
    [r.occurredAt.toISOString(), r.eventType, r.actorRole ?? 'система', escape(r.narrative)].join(
      ';',
    ),
  );
  return [header, ...lines].join('\n');
}

/** Дали огледалото се совпаѓа со очекуваната `after` вредност на планот. */
function matchesAfter(after: Record<string, unknown>, before: Record<string, unknown>): boolean {
  for (const [key, want] of Object.entries(after)) {
    if (key === 'dailyBudget') {
      if (Number(before.dailyBudget) !== Number(want)) return false;
    } else if (key === 'status') {
      // Огледалото користи status или effectiveStatus (ACTIVE/PAUSED).
      const cur = String(before.status ?? before.effectiveStatus ?? '').toUpperCase();
      if (cur !== String(want).toUpperCase()) return false;
    } else if (key === 'stopTime') {
      if (want == null) {
        if (before.stopTime != null) return false;
      } else {
        const cur = before.stopTime
          ? new Date(before.stopTime as string).toISOString().slice(0, 10)
          : null;
        const w = new Date(String(want)).toISOString().slice(0, 10);
        if (cur !== w) return false;
      }
    } else if (before[key] !== want) {
      return false;
    }
  }
  return true;
}

/**
 * По секој `meta.structure` sync: за `syncing` планови со верификабилна операција, спореди ја
 * `after` вредноста со огледалото. Совпаѓање → `done` + `meta.plan.confirmed`.
 */
export async function confirmPlansOnSync(clientId: string) {
  const plans = await prisma.metaChangePlan.findMany({
    where: { clientId, status: 'syncing' },
  });
  let confirmed = 0;
  for (const plan of plans) {
    if (!isPlanVerifiable(plan.op as OpCode)) continue;
    const after = plan.after as Record<string, unknown> | null;
    if (!after) continue;
    const mirror = await resolveMirror(prisma, plan.target as PlanTarget);
    if (!mirror) continue;
    if (!matchesAfter(after, mirror.before)) continue;
    await prisma.$transaction(async (tx) => {
      await tx.metaChangePlan.update({
        where: { id: plan.id },
        data: { status: 'done', confirmedAt: new Date() },
      });
      await recordEvent(tx, {
        eventType: 'meta.plan.confirmed',
        objectType: 'meta_plan',
        objectId: plan.id,
        clientId,
        taskId: plan.taskId,
        newValue: { status: 'done' },
        narrative: `Sync ја потврди промената „${opMeta(plan.op as OpCode).label}".`,
      });
    });
    confirmed += 1;
  }
  return { confirmed };
}

/**
 * `syncing` верификабилни планови постари од 24 ч без совпаѓање → `mismatch` + алерт до Директор.
 * Се повикува од `meta.status` cron.
 */
export async function evaluatePlanMismatch(now: Date = new Date()) {
  const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const plans = await prisma.metaChangePlan.findMany({
    where: { status: 'syncing', markedDoneAt: { lt: cutoff } },
  });
  let flagged = 0;
  for (const plan of plans) {
    if (!isPlanVerifiable(plan.op as OpCode)) continue;
    await prisma.$transaction(async (tx) => {
      await tx.metaChangePlan.update({ where: { id: plan.id }, data: { status: 'mismatch' } });
      await recordEvent(tx, {
        eventType: 'meta.plan.mismatch',
        objectType: 'meta_plan',
        objectId: plan.id,
        clientId: plan.clientId,
        taskId: plan.taskId,
        newValue: { status: 'mismatch' },
        narrative: `Нема совпаѓање 24 ч за „${opMeta(plan.op as OpCode).label}" — проверка потребна.`,
      });
    });
    flagged += 1;
  }
  return { flagged };
}
