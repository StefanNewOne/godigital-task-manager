import type { ContentType } from './roles.js';
import type { GroupStatus, TaskStatus } from './statuses.js';

/**
 * Рокови по статус (PRD §4.10). Default вредностите се seed за `StatusDeadlineConfig`;
 * во продукција се резолвираат по клиент → глобално. Ништо хардкодирано на друго место.
 * `deadlineFor = publishDate − leadDays` (таск) или `shootDate − leadDays` (капа).
 */

/** Дена ПРЕД публикација (таск). Негативно = дена ПО (analitika). */
export const DEFAULT_TASK_LEAD_DAYS: Record<ContentType, Partial<Record<TaskStatus, number>>> = {
  video: {
    chekaRezija: 8,
    montaza: 6,
    vnatresno: 4,
    kajKlient: 3,
    zaObjavuvanje: 1,
    objaveno: 0,
    analitika: -7,
  },
  graphic: {
    brifing: 7,
    dizajn: 5,
    vnatresno: 3,
    kajKlient: 2,
    zaObjavuvanje: 1,
    objaveno: 0,
    analitika: -7,
  },
};

/** Дена ПРЕД снимање (капа). gPodgotovka е 3 дена пред првиот слот. */
export const DEFAULT_GROUP_LEAD_DAYS: Partial<Record<GroupStatus, number>> = {
  podgotovka: 10,
  scenarija: 7,
  scenKajKlient: 3,
  snimanje: 0,
  gPodgotovka: 3,
};

/** Одземи цели денови од датум (враќа нов Date, на ниво на ден). */
export function subtractDays(date: Date, days: number): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() - days));
  return d;
}

/** Рок за таск статус спрямо публикациски датум (или null ако статусот нема рок). */
export function taskDeadline(
  status: TaskStatus,
  contentType: ContentType,
  publishDate: Date,
  leadOverride?: number,
): Date | null {
  const lead = leadOverride ?? DEFAULT_TASK_LEAD_DAYS[contentType][status];
  if (lead === undefined) return null;
  return subtractDays(publishDate, lead);
}

export type DeadlineLevel = 'overdue' | 'soon' | 'normal';

export interface DeadlineLabel {
  text: string;
  level: DeadlineLevel;
}

/** Еднина/множина за денови на македонски: 1 → „ден", инаку „дена". */
function denDena(n: number): string {
  return n === 1 ? 'ден' : 'дена';
}

/**
 * Етикета на рок (Handoff): „рок пречекорен N дена" / „рок денес" / „рок утре" / „рок за N дена".
 * Внимавај на еднината: `1 ден`, не `1 дена`.
 */
export function formatDeadlineLabel(deadline: Date, today: Date): DeadlineLabel {
  const MS_PER_DAY = 86_400_000;
  const a = Date.UTC(deadline.getUTCFullYear(), deadline.getUTCMonth(), deadline.getUTCDate());
  const b = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const diff = Math.floor((a - b) / MS_PER_DAY);

  if (diff < 0) {
    const n = Math.abs(diff);
    return { text: `рок пречекорен ${n} ${denDena(n)}`, level: 'overdue' };
  }
  if (diff === 0) return { text: 'рок денес', level: 'soon' };
  if (diff === 1) return { text: 'рок утре', level: 'soon' };
  return { text: `рок за ${diff} ${denDena(diff)}`, level: 'normal' };
}
