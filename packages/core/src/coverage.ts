import type { ContentType } from './roles.js';
import type { TaskStatus } from './statuses.js';

/**
 * Покриеност — единствена функција (PRD §4.9, CLAUDE.md И3 „Derive, never store").
 * Оваа логика храни: чип во List групата, картичка во Преглед, табела Клиенти и текст на алармот.
 * Никаде не се дуплира.
 */

export interface CoverageTask {
  status: TaskStatus;
  /** Публикацискиот датум (derived од слотот). null за таскови без слот. */
  publishDate: Date | null;
}

/** Статуси што НЕ се бројат во испланираната покриеност. */
const EXCLUDED_FROM_PLANNED: ReadonlySet<TaskStatus> = new Set<TaskStatus>([
  'mrtov',
  'otkazano',
  'pauza',
]);

/** Статуси што се бројат во „готовата" покриеност. */
const READY_STATUSES: ReadonlySet<TaskStatus> = new Set<TaskStatus>([
  'zaObjavuvanje',
  'objaveno',
  'analitika',
  'zavrseno',
]);

/** Цели денови од `today` до `date` (може да е негативно за минато). */
function daysUntil(date: Date, today: Date): number {
  const MS_PER_DAY = 86_400_000;
  const a = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const b = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.floor((a - b) / MS_PER_DAY);
}

function maxPublishDate(tasks: CoverageTask[], include: (s: TaskStatus) => boolean): Date | null {
  let max: Date | null = null;
  for (const t of tasks) {
    if (t.publishDate === null || !include(t.status)) continue;
    if (max === null || t.publishDate.getTime() > max.getTime()) max = t.publishDate;
  }
  return max;
}

/**
 * Испланирана покриеност: најдоцен датум меѓу тасковите што НЕ се мртви/откажани/паузирани,
 * минус денес, floored на 0. Ова е бројот што го користат алармот и лентите во боја.
 */
export function plannedCoverage(tasks: CoverageTask[], today: Date): number {
  const max = maxPublishDate(tasks, (s) => !EXCLUDED_FROM_PLANNED.has(s));
  if (max === null) return 0;
  return Math.max(0, daysUntil(max, today));
}

/**
 * Готова покриеност: најдоцен датум меѓу тасковите во „За објавување" или подоцна.
 * Информативен втор индикатор во Преглед („готово до {датум}"). НЕ се floor-ира.
 */
export function readyCoverage(tasks: CoverageTask[], today: Date): number {
  const max = maxPublishDate(tasks, (s) => READY_STATUSES.has(s));
  if (max === null) return 0;
  return daysUntil(max, today);
}

/**
 * Вкупна покриеност на клиент = најлошата (min) од видео и графика линиите,
 * само за типовите со количина > 0 (PRD §4.9).
 */
export function clientCoverage(
  input: Partial<Record<ContentType, { tasks: CoverageTask[]; quota: number }>>,
  today: Date,
): number {
  const values: number[] = [];
  for (const type of ['video', 'graphic'] as const) {
    const line = input[type];
    if (line && line.quota > 0) values.push(plannedCoverage(line.tasks, today));
  }
  if (values.length === 0) return 0;
  return Math.min(...values);
}

export type CoverageLevel = 'ok' | 'warn' | 'danger';

/** Праг за боја (Handoff): > 14 зелено, 7–14 портокалово, < 7 црвено. */
export function coverageLevel(days: number): CoverageLevel {
  if (days > 14) return 'ok';
  if (days >= 7) return 'warn';
  return 'danger';
}
