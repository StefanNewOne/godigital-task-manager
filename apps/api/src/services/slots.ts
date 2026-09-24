import {
  ROLE_LABEL,
  canChangeDate,
  generateSlots,
  ymd,
  type CalendarSpec,
  type ContentType,
  type Role,
} from '@gd/core';
import { prisma, type TxClient } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { recordEvent } from '../lib/events.js';

const NON_CHANGEABLE = new Set(['objaveno', 'analitika', 'zavrseno', 'otkazano']);

export function parseMonthKey(month: string): { year: number; month0: number } {
  const year = Number(month.slice(0, 4));
  const month0 = Number(month.slice(5, 7)) - 1;
  return { year, month0 };
}

function autoTitle(clientName: string, contentType: ContentType, date: Date): string {
  const label = contentType === 'video' ? 'Видео' : 'Графика';
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${clientName} · ${label} · ${dd}.${mm}`;
}

async function loadHolidaySet(
  clientId: string,
  year: number,
  month0: number,
): Promise<Set<string>> {
  const from = new Date(Date.UTC(year, month0, 1));
  const to = new Date(Date.UTC(year, month0 + 1, 0));
  const rows = await prisma.holiday.findMany({
    where: {
      date: { gte: from, lte: to },
      OR: [{ clientId: null }, { clientId }],
    },
  });
  return new Set(rows.map((h) => ymd(h.date)));
}

/** Генерирај предлог-слотови за месец (идемпотентно по клиент+месец). */
export async function generateProposalSlots(clientId: string, month: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);

  const existing = await prisma.publishingSlot.findFirst({ where: { clientId, monthKey: month } });
  if (existing) {
    return prisma.publishingSlot.findMany({ where: { clientId, monthKey: month } });
  }

  const { year, month0 } = parseMonthKey(month);
  const holidays = await loadHolidaySet(clientId, year, month0);
  const configs = await prisma.calendarConfig.findMany({ where: { clientId } });

  const quotas: Record<ContentType, number> = {
    video: client.videosPerMonth,
    graphic: client.graphicsPerMonth,
  };

  return prisma.$transaction(async (tx) => {
    for (const contentType of ['video', 'graphic'] as ContentType[]) {
      const quota = quotas[contentType];
      if (quota <= 0) continue;
      const config = configs.find((c) => c.contentType === contentType);
      if (!config) continue;

      const spec: CalendarSpec = {
        year,
        month0,
        weekdays: config.weekdays,
        holidays,
        allowTwoPerDay: config.allowTwoPerDay,
      };
      const { slots } = generateSlots(spec, quota);
      for (const s of slots) {
        await tx.publishingSlot.create({
          data: {
            clientId,
            contentType,
            date: s.date,
            orderInDay: s.orderInDay,
            status: 'predlog',
            monthKey: month,
          },
        });
      }
    }
    await recordEvent(
      tx as TxClient,
      {
        eventType: 'slots.generated',
        objectType: 'client',
        objectId: clientId,
        clientId,
        narrative: `Генериран предлог-распоред за „${client.name}" · ${month}.`,
      },
      ['realtime'],
    );
    return tx.publishingSlot.findMany({ where: { clientId, monthKey: month } });
  });
}

/** monthKey за следниот месец од дадена основа (default: денес). */
export function nextMonthKey(base = new Date()): string {
  const y = base.getUTCFullYear();
  const m = base.getUTCMonth() + 1; // следен месец (0-based +1)
  const year = m > 11 ? y + 1 : y;
  const month0 = m > 11 ? 0 : m;
  return `${year}-${String(month0 + 1).padStart(2, '0')}`;
}

/** Cron: генерирај предлог-слотови за сите активни клиенти за даден месец. */
export async function generateForAllActiveClients(month: string) {
  const clients = await prisma.client.findMany({ where: { status: 'aktiven', archivedAt: null } });
  const results: Array<{ clientId: string; name: string; slots: number }> = [];
  for (const c of clients) {
    const slots = await generateProposalSlots(c.id, month);
    results.push({ clientId: c.id, name: c.name, slots: slots.length });
  }
  return { month, clients: results.length, results };
}

/** Потврди месец: predlog→reserved, автоматска капа (D-7), мртви таскови по слот. */
export async function confirmMonth(clientId: string, month: string) {
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (!client) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);

  const slots = await prisma.publishingSlot.findMany({
    where: { clientId, monthKey: month, status: 'predlog' },
    orderBy: { date: 'asc' },
  });
  if (slots.length === 0) {
    throw new AppError('VALIDATION_FAILED', 'Нема предлог-слотови за овој месец.', 400);
  }

  const quotas: Record<ContentType, number> = {
    video: client.videosPerMonth,
    graphic: client.graphicsPerMonth,
  };

  return prisma.$transaction(async (tx) => {
    const groupByType = new Map<ContentType, string>();

    for (const contentType of ['video', 'graphic'] as ContentType[]) {
      if (!slots.some((s) => s.contentType === contentType)) continue;
      let group = await tx.taskGroup.findFirst({
        where: { clientId, contentType, monthKey: month },
      });
      if (!group) {
        group = await tx.taskGroup.create({
          data: {
            clientId,
            contentType,
            monthKey: month,
            status: contentType === 'video' ? 'podgotovka' : 'gPodgotovka',
            plannedCount: quotas[contentType],
          },
        });
      }
      groupByType.set(contentType, group.id);
    }

    for (const slot of slots) {
      const groupId = groupByType.get(slot.contentType)!;
      await tx.task.create({
        data: {
          groupId,
          clientId,
          contentType: slot.contentType,
          title: autoTitle(client.name, slot.contentType, slot.date),
          titleIsAuto: true,
          status: 'mrtov',
          slotId: slot.id,
        },
      });
      await tx.publishingSlot.update({ where: { id: slot.id }, data: { status: 'reserved' } });
    }

    await recordEvent(tx as TxClient, {
      eventType: 'month.confirmed',
      objectType: 'client',
      objectId: clientId,
      clientId,
      newValue: { month, slots: slots.length },
      narrative: `Потврден месец ${month} за „${client.name}" · ${slots.length} резервирани слотови.`,
    });

    return { reserved: slots.length, groups: groupByType.size };
  });
}

/** Промена на датум (PRD §4.5): стар слот → free, нов слот → reserved, DateChange + EventLog. */
export async function changeTaskDate(
  taskId: string,
  input: { newDate: Date; orderInDay?: number; reason: string },
  actor: { id: string; role: Role },
) {
  const task = await prisma.task.findUnique({ where: { id: taskId }, include: { client: true } });
  if (!task) throw new AppError('NOT_FOUND', 'Таскот не е пронајден.', 404);
  if (NON_CHANGEABLE.has(task.status)) {
    throw new AppError('VALIDATION_FAILED', 'Датумот не може да се менува на овој статус.', 400);
  }
  if (actor.role !== 'dir' && actor.role !== 'am' && !canChangeDate(actor.role, task.contentType)) {
    throw new AppError('FORBIDDEN_ROLE', 'Немате дозвола да го менувате датумот.', 403);
  }
  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const newUtc = Date.UTC(
    input.newDate.getUTCFullYear(),
    input.newDate.getUTCMonth(),
    input.newDate.getUTCDate(),
  );
  if (newUtc < todayUtc) {
    throw new AppError('DATE_IN_PAST', 'Не е дозволено поместување на датум во минатото.', 400);
  }
  const orderInDay = input.orderInDay ?? 1;
  const monthKey = `${input.newDate.getUTCFullYear()}-${String(input.newDate.getUTCMonth() + 1).padStart(2, '0')}`;

  return prisma.$transaction(async (tx) => {
    let target = await tx.publishingSlot.findFirst({
      where: {
        clientId: task.clientId,
        contentType: task.contentType,
        date: input.newDate,
        orderInDay,
        status: 'free',
      },
    });
    if (!target) {
      target = await tx.publishingSlot.create({
        data: {
          clientId: task.clientId,
          contentType: task.contentType,
          date: input.newDate,
          orderInDay,
          status: 'reserved',
          monthKey,
        },
      });
    } else {
      await tx.publishingSlot.update({ where: { id: target.id }, data: { status: 'reserved' } });
    }

    const oldSlotId = task.slotId;
    const newTitle = task.titleIsAuto
      ? autoTitle(task.client.name, task.contentType, input.newDate)
      : task.title;
    await tx.task.update({
      where: { id: task.id },
      data: { slotId: target.id, title: newTitle },
    });
    if (oldSlotId) {
      await tx.publishingSlot.update({ where: { id: oldSlotId }, data: { status: 'free' } });
    }
    await tx.dateChange.create({
      data: {
        taskId: task.id,
        oldSlotId,
        newSlotId: target.id,
        reason: input.reason,
        changedById: actor.id,
        changedByRole: actor.role,
      },
    });
    await recordEvent(tx as TxClient, {
      eventType: 'task.dateChanged',
      objectType: 'task',
      objectId: task.id,
      taskId: task.id,
      clientId: task.clientId,
      newValue: { date: ymd(input.newDate), orderInDay },
      narrative: `Променет датум на таскот „${newTitle}" на ${ymd(input.newDate)} (причина: ${input.reason}).`,
    });
    return tx.task.findUnique({ where: { id: task.id } });
  });
}

/**
 * Дополнителен (екстра) таск во постоечка капа (прототип „Ново видео/графика").
 * Видео стартува во `chekaRezija`, графика во `brifing`, на резервиран слот за дадениот датум.
 * Бара веќе отворена капа за (клиент, тип, месец) — инаку упатува на Календар (Потврди месец).
 */
export async function createExtraTask(
  input: { clientId: string; contentType: ContentType; title: string; date: Date },
  actor: { id: string; role: Role },
) {
  // Дозвола: видео → Режисер, графика → Гр. креатор (плюс Директор, D-5).
  if (actor.role !== 'dir') {
    if (input.contentType === 'video' && actor.role !== 'rez') {
      throw new AppError('FORBIDDEN_ROLE', 'Само Режисер може да создаде екстра видео.', 403);
    }
    if (input.contentType === 'graphic' && actor.role !== 'krea') {
      throw new AppError('FORBIDDEN_ROLE', 'Само Гр. креатор може да создаде екстра графика.', 403);
    }
  }

  const client = await prisma.client.findUnique({ where: { id: input.clientId } });
  if (!client) throw new AppError('NOT_FOUND', 'Клиентот не е пронајден.', 404);

  const now = new Date();
  const todayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const dUtc = Date.UTC(
    input.date.getUTCFullYear(),
    input.date.getUTCMonth(),
    input.date.getUTCDate(),
  );
  if (dUtc < todayUtc) {
    throw new AppError('DATE_IN_PAST', 'Не е дозволен датум во минато.', 400);
  }

  const monthKey = `${input.date.getUTCFullYear()}-${String(input.date.getUTCMonth() + 1).padStart(2, '0')}`;
  const status = input.contentType === 'video' ? 'chekaRezija' : 'brifing';
  const defaults = (client.defaultAssignees ?? {}) as Record<string, string>;

  return prisma.$transaction(async (tx) => {
    // Интервентен таск НЕ зависи од потврден месец — контејнер-капа се создава ако ја нема
    // (претходно снимен/интернет материјал што ја заобиколува претпродукцијата).
    let group = await tx.taskGroup.findFirst({
      where: { clientId: input.clientId, contentType: input.contentType, monthKey },
    });
    let createdGroup = false;
    if (!group) {
      group = await tx.taskGroup.create({
        data: {
          clientId: input.clientId,
          contentType: input.contentType,
          monthKey,
          status: input.contentType === 'video' ? 'podgotovka' : 'gPodgotovka',
          plannedCount:
            input.contentType === 'video' ? client.videosPerMonth : client.graphicsPerMonth,
          rezId:
            input.contentType === 'video'
              ? (defaults.rez ?? (actor.role === 'rez' ? actor.id : null))
              : null,
        },
      });
      createdGroup = true;
    }

    const assigneeId =
      input.contentType === 'video'
        ? (group.rezId ?? defaults.rez ?? (actor.role === 'rez' ? actor.id : null))
        : (defaults.krea ?? (actor.role === 'krea' ? actor.id : null));

    const existing = await tx.publishingSlot.findFirst({
      where: { clientId: input.clientId, contentType: input.contentType, date: input.date },
      orderBy: { orderInDay: 'desc' },
    });
    const orderInDay = existing ? existing.orderInDay + 1 : 1;
    const slot = await tx.publishingSlot.create({
      data: {
        clientId: input.clientId,
        contentType: input.contentType,
        date: input.date,
        orderInDay,
        status: 'reserved',
        monthKey,
      },
    });
    const task = await tx.task.create({
      data: {
        groupId: group.id,
        clientId: input.clientId,
        contentType: input.contentType,
        title: input.title,
        titleIsAuto: false,
        status: status as never,
        isExtra: true,
        slotId: slot.id,
        assigneeId,
        rezId: input.contentType === 'video' ? assigneeId : null,
        kreaId: input.contentType === 'graphic' ? assigneeId : null,
      },
    });
    await recordEvent(tx as TxClient, {
      eventType: 'task.extraCreated',
      objectType: 'task',
      objectId: task.id,
      taskId: task.id,
      clientId: input.clientId,
      newValue: { status, date: ymd(input.date), isExtra: true, createdGroup },
      narrative: `${ROLE_LABEL[actor.role]} создаде интервентен ${input.contentType === 'video' ? 'видео' : 'графички'} таск „${input.title}" во капата „${client.name} · ${monthKey}"${createdGroup ? ' (нова капа)' : ''}.`,
    });
    return tx.task.findUnique({ where: { id: task.id } });
  });
}
