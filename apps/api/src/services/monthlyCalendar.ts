import {
  clientActiveForDate,
  generateSlots,
  groupByCombination,
  ymd,
  type ContentType,
  type Role,
} from '@gd/core';
import type { Client } from '@gd/db';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { recordEvent } from '../lib/events.js';
import { createNotification } from './notifications.js';
import { confirmMonth, loadHolidaySet, parseMonthKey } from './slots.js';

export interface ComboProposal {
  videos: number;
  graphics: number;
  clients: Array<{ id: string; name: string }>;
  /** 'YYYY-MM-DD' датуми (може да се повторат ако „2 по ден"). */
  videoDates: string[];
  graphicDates: string[];
  /** Сите клиенти во комбинацијата имаат reserved слотови за месецот. */
  approved: boolean;
}
export interface MonthProposal {
  month: string;
  hasStandard: boolean;
  videoWeekdays: number[];
  graphicWeekdays: number[];
  combinations: ComboProposal[];
}

const comboKey = (v: number, g: number) => `${v}x${g}`;

async function firstDayEligibleStandardClients(month: string): Promise<Client[]> {
  const { year, month0 } = parseMonthKey(month);
  const first = new Date(Date.UTC(year, month0, 1));
  const clients = await prisma.client.findMany({
    where: { status: 'aktiven', archivedAt: null, calendarType: 'standarden' },
    orderBy: { name: 'asc' },
  });
  return clients.filter((c) => clientActiveForDate(c.deactivatedAt, first));
}

/** Датуми за комбинација преку стандардните неделни денови + бројка (детерминистички). */
function comboDates(
  year: number,
  month0: number,
  weekdays: number[],
  allowTwoPerDay: boolean,
  holidays: Set<string>,
  count: number,
): string[] {
  if (count <= 0 || weekdays.length === 0) return [];
  const { slots } = generateSlots({ year, month0, weekdays, holidays, allowTwoPerDay }, count);
  return slots.map((s) => ymd(s.date));
}

/** Предлог за месец, групиран по комбинација (за АМ да одобри). */
export async function getMonthProposal(month: string): Promise<MonthProposal> {
  const { year, month0 } = parseMonthKey(month);
  const clients = await firstDayEligibleStandardClients(month);
  const combos = groupByCombination(
    clients.map((c) => ({
      id: c.id,
      name: c.name,
      videosPerMonth: c.videosPerMonth,
      graphicsPerMonth: c.graphicsPerMonth,
    })),
  );

  const [stdVideo, stdGraphic] = await Promise.all([
    prisma.calendarConfig.findFirst({ where: { clientId: null, contentType: 'video' } }),
    prisma.calendarConfig.findFirst({ where: { clientId: null, contentType: 'graphic' } }),
  ]);
  const holidays = await loadHolidaySet('', year, month0);

  const combinations: ComboProposal[] = [];
  for (const combo of combos) {
    const clientIds = combo.clients.map((c) => c.id);
    const reservedCount = await prisma.publishingSlot.count({
      where: {
        clientId: { in: clientIds },
        monthKey: month,
        status: { in: ['reserved', 'used'] },
      },
    });
    // Одобрено = секој клиент во комбинацијата има барем еден reserved слот.
    const withReserved = await prisma.publishingSlot.groupBy({
      by: ['clientId'],
      where: { clientId: { in: clientIds }, monthKey: month, status: { in: ['reserved', 'used'] } },
    });
    combinations.push({
      videos: combo.videos,
      graphics: combo.graphics,
      clients: combo.clients.map((c) => ({ id: c.id, name: c.name })),
      videoDates: stdVideo
        ? comboDates(
            year,
            month0,
            stdVideo.weekdays,
            stdVideo.allowTwoPerDay,
            holidays,
            combo.videos,
          )
        : [],
      graphicDates: stdGraphic
        ? comboDates(
            year,
            month0,
            stdGraphic.weekdays,
            stdGraphic.allowTwoPerDay,
            holidays,
            combo.graphics,
          )
        : [],
      approved: reservedCount > 0 && withReserved.length === clientIds.length,
    });
  }

  return {
    month,
    hasStandard: !!(stdVideo ?? stdGraphic),
    videoWeekdays: stdVideo?.weekdays ?? [],
    graphicWeekdays: stdGraphic?.weekdays ?? [],
    combinations,
  };
}

/** Создади predlog слотови на дадени датуми (orderInDay се пресметува по датум). */
async function createPredlog(
  clientId: string,
  month: string,
  contentType: ContentType,
  dates: string[],
): Promise<void> {
  const perDate = new Map<string, number>();
  for (const d of dates) {
    const order = (perDate.get(d) ?? 0) + 1;
    perDate.set(d, order);
    await prisma.publishingSlot.create({
      data: {
        clientId,
        contentType,
        date: new Date(`${d}T00:00:00.000Z`),
        orderInDay: order,
        status: 'predlog',
        monthKey: month,
      },
    });
  }
}

/**
 * Одобри месец за сите СТАНДАРДНИ клиенти (АМ/Директор), групирано по комбинација. За секој
 * клиент што сè уште нема reserved слотови: создава predlog по (изменетиот) layout → `confirmMonth`
 * (reserved + мртви таскови + авто-капа). Идемпотентно (веќе одобрените се прескокнуваат).
 */
export async function approveMonthForAllStandard(
  month: string,
  actor: { id: string; role: Role },
  edits?: Record<string, { videoDates: string[]; graphicDates: string[] }>,
) {
  if (actor.role !== 'am' && actor.role !== 'dir') {
    throw new AppError('FORBIDDEN_ROLE', 'Само Акаунт менаџер или Директор може да одобри.', 403);
  }
  const proposal = await getMonthProposal(month);
  let approvedClients = 0;
  let skipped = 0;

  for (const combo of proposal.combinations) {
    const layout = edits?.[comboKey(combo.videos, combo.graphics)] ?? {
      videoDates: combo.videoDates,
      graphicDates: combo.graphicDates,
    };
    // Комбинација без датуми (пр. клиент без пакет) — нема што да се одобри.
    if (layout.videoDates.length + layout.graphicDates.length === 0) {
      skipped += combo.clients.length;
      continue;
    }
    for (const cl of combo.clients) {
      const hasReserved = await prisma.publishingSlot.count({
        where: { clientId: cl.id, monthKey: month, status: { in: ['reserved', 'used'] } },
      });
      if (hasReserved > 0) {
        skipped++;
        continue;
      }
      await prisma.publishingSlot.deleteMany({
        where: { clientId: cl.id, monthKey: month, status: 'predlog' },
      });
      await createPredlog(cl.id, month, 'video', layout.videoDates);
      await createPredlog(cl.id, month, 'graphic', layout.graphicDates);
      await confirmMonth(cl.id, month);
      approvedClients++;
    }
  }

  await recordEvent(prisma, {
    eventType: 'monthlyCalendar.approved',
    objectType: 'monthlyCalendar',
    objectId: month,
    newValue: { month, approvedClients, skipped },
    narrative: `${actor.role === 'am' ? 'Акаунт менаџерот' : 'Директорот'} одобри календар за ${month} · ${approvedClients} клиенти.`,
  });

  return { month, approvedClients, skipped, combinations: proposal.combinations.length };
}

/** Дали месецот е одобрен за клиент = има reserved/used слотови. */
export async function isMonthApprovedForClient(clientId: string, month: string): Promise<boolean> {
  const count = await prisma.publishingSlot.count({
    where: { clientId, monthKey: month, status: { in: ['reserved', 'used'] } },
  });
  return count > 0;
}

/** Аларм до сите активни Акаунт менаџери да го одобрат календарот за клиент+месец. */
async function alertAmApproveMonth(clientId: string, clientName: string, month: string) {
  const managers = await prisma.employee.findMany({
    where: { role: 'am', active: true },
    select: { id: true },
  });
  for (const m of managers) {
    await createNotification({
      recipientId: m.id,
      level: 'alarm',
      eventKey: 'month_not_approved',
      clientId,
      title: 'Одобри календар',
      body: `Одобри го календарот за „${clientName}" · ${month} за да може да се создаде капа.`,
    }).catch(() => undefined);
  }
}

/**
 * Тврд гејт: месецот мора да е одобрен (reserved слотови) за клиентот. Инаку → аларм до АМ +
 * `MONTH_NOT_APPROVED`. Се вика при креирање нова капа (редизајн).
 */
export async function assertMonthApproved(
  client: Pick<Client, 'id' | 'name'>,
  month: string,
): Promise<void> {
  if (await isMonthApprovedForClient(client.id, month)) return;
  await alertAmApproveMonth(client.id, client.name, month);
  throw new AppError(
    'MONTH_NOT_APPROVED',
    `Месецот ${month} не е одобрен за „${client.name}". Акаунт менаџерот е известен да го одобри календарот.`,
    400,
  );
}
