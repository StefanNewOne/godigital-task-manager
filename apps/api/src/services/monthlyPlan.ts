import type { NotificationLevel, Role } from '@gd/core';
import { prisma, type TxClient } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { recordEvent } from '../lib/events.js';
import { createNotification } from './notifications.js';

export interface MonthlyPlanClientRow {
  clientId: string;
  name: string;
  color: string;
  active: boolean;
}

export interface MonthlyPlanView {
  monthKey: string;
  confirmed: boolean;
  confirmedAt: string | null;
  clients: MonthlyPlanClientRow[];
}

/**
 * Приказ на месечниот план: сите (незавршени) клиенти со нивниот active-флаг за месецот.
 * Ако нема запис за клиент → default active=true (Директорот гледа сè пред-обележано).
 */
export async function getMonthlyPlan(monthKey: string): Promise<MonthlyPlanView> {
  const [plan, clients] = await Promise.all([
    prisma.monthlyPlan.findFirst({ where: { monthKey }, include: { clients: true } }),
    prisma.client.findMany({
      where: { status: { not: 'zavrsen' }, archivedAt: null },
      orderBy: { name: 'asc' },
      select: { id: true, name: true, color: true },
    }),
  ]);
  const byId = new Map((plan?.clients ?? []).map((c) => [c.clientId, c.active]));
  return {
    monthKey,
    confirmed: !!plan?.confirmedAt,
    confirmedAt: plan?.confirmedAt?.toISOString() ?? null,
    clients: clients.map((c) => ({
      clientId: c.id,
      name: c.name,
      color: c.color,
      active: byId.get(c.id) ?? true,
    })),
  };
}

/** Зачувај ги toggle-ите (материјализира запис за секој испратен клиент). Само Директор. */
export async function putMonthlyPlan(
  monthKey: string,
  input: { clients: Array<{ clientId: string; active: boolean }> },
  actor: { id: string; role: Role },
): Promise<MonthlyPlanView> {
  if (actor.role !== 'dir') {
    throw new AppError('FORBIDDEN_ROLE', 'Само Директор може да го уредува месечниот план.', 403);
  }
  await prisma.$transaction(async (tx) => {
    const plan = await ensurePlan(tx, monthKey);
    for (const c of input.clients) {
      await tx.monthlyPlanClient.upsert({
        where: { monthlyPlanId_clientId: { monthlyPlanId: plan.id, clientId: c.clientId } },
        create: { monthlyPlanId: plan.id, clientId: c.clientId, active: c.active },
        update: { active: c.active },
      });
    }
  });
  return getMonthlyPlan(monthKey);
}

/** Потврди го месецот (стамп confirmedAt). Бара барем еден активен клиент. Само Директор. */
export async function confirmMonthlyPlan(
  monthKey: string,
  actor: { id: string; role: Role },
): Promise<MonthlyPlanView> {
  if (actor.role !== 'dir') {
    throw new AppError('FORBIDDEN_ROLE', 'Само Директор може да го потврди месечниот план.', 403);
  }
  await prisma.$transaction(async (tx) => {
    const plan = await ensurePlan(tx, monthKey);
    const active = await tx.monthlyPlanClient.count({
      where: { monthlyPlanId: plan.id, active: true },
    });
    if (active < 1) {
      throw new AppError(
        'VALIDATION_FAILED',
        'Мора барем еден клиент да е активен за да се потврди месецот.',
        400,
      );
    }
    await tx.monthlyPlan.update({
      where: { id: plan.id },
      data: { confirmedAt: new Date(), confirmedById: actor.id },
    });
    await recordEvent(
      tx as TxClient,
      {
        eventType: 'monthlyPlan.confirmed',
        objectType: 'monthlyPlan',
        objectId: plan.id,
        newValue: { monthKey, activeClients: active },
        narrative: `Директорот ја потврди месечната листа за ${monthKey} · ${active} активни клиенти.`,
      },
      ['realtime'],
    );
  });
  return getMonthlyPlan(monthKey);
}

/**
 * Мек гејт (одлука на сопственикот, rec #1): важи САМО за месеци со потврден план.
 * Нема план / непотврден → дозволено (демо и историски месеци не се кршат).
 */
export async function isClientApprovedForMonth(
  clientId: string,
  monthKey: string,
): Promise<boolean> {
  const plan = await prisma.monthlyPlan.findFirst({
    where: { monthKey },
    include: { clients: true },
  });
  if (!plan || !plan.confirmedAt) return true;
  const entry = plan.clients.find((c) => c.clientId === clientId);
  return !!entry && entry.active;
}

/** Фрли грешка ако клиентот не е одобрен за месецот (порта врз креирање капа/интервентен таск). */
export async function assertClientApprovedForMonth(
  clientId: string,
  monthKey: string,
): Promise<void> {
  if (!(await isClientApprovedForMonth(clientId, monthKey))) {
    throw new AppError(
      'MONTH_NOT_APPROVED',
      `Клиентот не е одобрен за ${monthKey}. Директорот мора да ја потврди месечната листа за тој месец.`,
      400,
    );
  }
}

async function ensurePlan(tx: TxClient, monthKey: string) {
  const existing = await tx.monthlyPlan.findFirst({ where: { monthKey } });
  if (existing) return existing;
  return tx.monthlyPlan.create({ data: { monthKey } });
}

function nextMonthKeyOf(base: Date): string {
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + 1; // следен месец (0-based +1)
  const year = m > 11 ? y + 1 : y;
  const month0 = m > 11 ? 0 : m;
  return `${year}-${String(month0 + 1).padStart(2, '0')}`;
}

/**
 * Cron (дневно): ако наредниот месец нема потврден план → потсети го Директорот.
 * До 15-ти: тивко. На 15-ти: `potsetnik`. По 15-ти: `kritichen` (аларм додека не потврди).
 */
export async function remindMonthlyPlan(now = new Date()) {
  const targetMonth = nextMonthKeyOf(now);
  const plan = await prisma.monthlyPlan.findFirst({ where: { monthKey: targetMonth } });
  if (plan?.confirmedAt) return { targetMonth, confirmed: true, notified: 0 };

  const day = now.getUTCDate();
  if (day < 15) return { targetMonth, confirmed: false, notified: 0, tooEarly: true };

  const level: NotificationLevel = day === 15 ? 'potsetnik' : 'kritichen';
  const dirs = await prisma.employee.findMany({
    where: { role: 'dir', active: true },
    select: { id: true },
  });
  let notified = 0;
  for (const d of dirs) {
    const created = await createNotification({
      recipientId: d.id,
      level,
      eventKey: 'monthly_plan_confirm',
      title: level === 'potsetnik' ? 'Потврди месечна листа' : 'Месечната листа не е потврдена',
      body: `Потврди ги активните клиенти за ${targetMonth} (рок 15-ти во месецот).`,
    }).catch(() => null);
    if (created) notified++;
  }
  return { targetMonth, confirmed: false, notified, level };
}
