import { generateSlots, type CalendarSpec, type ContentType } from '@gd/core';
import type { TxClient } from '../../db/tenantExtension.js';
import { recordEvent } from '../../lib/events.js';
import { resolveCalendar } from '../calendar.js';
import { loadHolidaySet, parseMonthKey } from '../slots.js';
import type { LeadWithChildren } from './view.js';

// Палета за боја на клиент (иста како во прототипот).
const PALETTE = ['#4F46E5', '#B45309', '#9333EA', '#0F766E'];

function autoTitle(clientName: string, contentType: ContentType, date: Date): string {
  const label = contentType === 'video' ? 'Видео' : 'Графика';
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${clientName} · ${label} · ${dd}.${mm}`;
}

/** Тим (Json {role:id}) → Client.defaultAssignees (само пополнетите). */
function teamToAssignees(team: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (team && typeof team === 'object') {
    for (const [role, id] of Object.entries(team as Record<string, unknown>)) {
      if (typeof id === 'string' && id) out[role] = id;
    }
  }
  return out;
}

/**
 * Активација (чекор 11, effect E_ACTIVATE): од лид се создава реален Client во Модул 1 со
 * параметрите на пакетот 1:1, датумите од првиот месец стануваат РЕЗЕРВИРАНИ слотови со мртви
 * таскови, и месецот се обележува како одобрен (за гејтот на новите капи). Следните месеци се
 * генерираат на 20-ти во претходниот (постоечки cron). Враќа id на новиот клиент.
 */
export async function activateLeadClient(tx: TxClient, lead: LeadWithChildren): Promise<string> {
  const start = lead.pkgStart ?? '';
  const { year, month0 } = parseMonthKey(start);
  const contractStart = new Date(Date.UTC(year, month0, 1));

  const count = await tx.client.count();
  const client = await tx.client.create({
    data: {
      name: lead.name,
      color: PALETTE[count % PALETTE.length] ?? '#4F46E5',
      contractStart,
      contractMonths: lead.pkgMonths || 1,
      videosPerMonth: lead.pkgVideos,
      graphicsPerMonth: lead.pkgGraphics,
      usesMetaAds: lead.pkgMeta,
      calendarType: lead.pkgCalType,
      defaultAssignees: teamToAssignees(lead.team),
    },
  });

  // Денови за првиот месец: специфичен → од content планерот; стандарден → генерирани.
  const days: Array<{ day: number; contentType: ContentType }> = [];
  if (lead.pkgCalType === 'specificen') {
    for (const e of lead.planEntries) {
      if (e.monthKey === start) days.push({ day: e.day, contentType: e.contentType });
    }
  } else {
    const holidays = await loadHolidaySet(client.id, year, month0);
    const quotas: Record<ContentType, number> = {
      video: lead.pkgVideos,
      graphic: lead.pkgGraphics,
    };
    for (const contentType of ['video', 'graphic'] as ContentType[]) {
      if (quotas[contentType] <= 0) continue;
      const config = await resolveCalendar(tx, client.id, client.calendarType, contentType);
      if (!config) continue;
      const spec: CalendarSpec = {
        year,
        month0,
        weekdays: config.weekdays,
        holidays,
        allowTwoPerDay: config.allowTwoPerDay,
      };
      const { slots } = generateSlots(spec, quotas[contentType]);
      for (const s of slots) days.push({ day: s.date.getUTCDate(), contentType });
    }
  }

  // Капи по тип (video→podgotovka, graphic→gPodgotovka) + резервирани слотови + мртви таскови.
  const groupByType = new Map<ContentType, string>();
  const orderSeen = new Map<string, number>(); // ден+тип → orderInDay
  for (const { day, contentType } of days.sort((a, b) => a.day - b.day)) {
    let groupId = groupByType.get(contentType);
    if (!groupId) {
      const group = await tx.taskGroup.create({
        data: {
          clientId: client.id,
          contentType,
          monthKey: start,
          status: contentType === 'video' ? 'podgotovka' : 'gPodgotovka',
          plannedCount: contentType === 'video' ? lead.pkgVideos : lead.pkgGraphics,
        },
      });
      groupId = group.id;
      groupByType.set(contentType, groupId);
    }
    const date = new Date(Date.UTC(year, month0, day));
    const okey = `${day}-${contentType}`;
    const orderInDay = (orderSeen.get(okey) ?? 0) + 1;
    orderSeen.set(okey, orderInDay);
    const slot = await tx.publishingSlot.create({
      data: {
        clientId: client.id,
        contentType,
        date,
        orderInDay,
        status: 'reserved',
        monthKey: start,
      },
    });
    await tx.task.create({
      data: {
        groupId,
        clientId: client.id,
        contentType,
        title: autoTitle(client.name, contentType, date),
        titleIsAuto: true,
        status: 'mrtov',
        slotId: slot.id,
      },
    });
  }

  // Обележи го првиот месец како одобрен за новиот клиент (гејт за нови капи, Парче 4).
  const existing = await tx.monthlyPlan.findFirst({ where: { monthKey: start } });
  const plan = existing ?? (await tx.monthlyPlan.create({ data: { monthKey: start } }));
  await tx.monthlyPlanClient.upsert({
    where: { monthlyPlanId_clientId: { monthlyPlanId: plan.id, clientId: client.id } },
    create: { monthlyPlanId: plan.id, clientId: client.id, active: true },
    update: { active: true },
  });
  if (!plan.confirmedAt) {
    await tx.monthlyPlan.update({ where: { id: plan.id }, data: { confirmedAt: new Date() } });
  }

  await recordEvent(
    tx,
    {
      eventType: 'client.activatedFromLead',
      objectType: 'client',
      objectId: client.id,
      clientId: client.id,
      newValue: { fromLead: lead.id, month: start, slots: days.length },
      narrative: `Клиентот „${client.name}" е активиран од лид · ${days.length} резервирани слотови за ${start}.`,
    },
    ['realtime'],
  );

  return client.id;
}
