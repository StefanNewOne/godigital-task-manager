/**
 * Детерминистички распоред на слотови (PRD §4.5). Чиста функција — тестабилна, без I/O.
 * Се користи од `slots.generate` job-от и од предлог-распоредот. Датумите не се менуваат
 * подоцна при активација (D-2).
 */

export interface CalendarSpec {
  year: number;
  month0: number; // 0–11
  weekdays: number[]; // 1=пон … 7=нед (ISO)
  holidays: ReadonlySet<string>; // 'YYYY-MM-DD' (global + client)
  allowTwoPerDay: boolean;
}

export interface SlotPlan {
  date: Date;
  orderInDay: number; // 1 или 2
  needsManualConfirm: boolean; // true за orderInDay=2 (втор пост во ист ден)
}

export interface GenerateResult {
  slots: SlotPlan[];
  /** Количина што не се собрала во месецот → се пренесува со carriedFromMonth. */
  carriedToNextMonth: number;
}

const MS_DAY = 'YYYY-MM-DD';

/** ISO ден во неделата: 1=пон … 7=нед. */
export function isoWeekday(date: Date): number {
  const g = date.getUTCDay();
  return g === 0 ? 7 : g;
}

/** Формат 'YYYY-MM-DD' (UTC) — за споредба со празници. */
export function ymd(date: Date): string {
  return date.toISOString().slice(0, MS_DAY.length);
}

/** Сортирани дозволени датуми во месецот: weekdays минус празници. */
export function allowedDatesInMonth(spec: CalendarSpec): Date[] {
  const wd = new Set(spec.weekdays);
  const daysInMonth = new Date(Date.UTC(spec.year, spec.month0 + 1, 0)).getUTCDate();
  const dates: Date[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = new Date(Date.UTC(spec.year, spec.month0, d));
    if (!wd.has(isoWeekday(date))) continue;
    if (spec.holidays.has(ymd(date))) continue;
    dates.push(date);
  }
  return dates;
}

/** Рамномерни индекси: D[ floor((i+0.5)*m/n) ]. 4 во 9 → [1,3,5,7]. */
export function evenIndices(m: number, n: number): number[] {
  const idx: number[] = [];
  for (let i = 0; i < n; i++) idx.push(Math.floor(((i + 0.5) * m) / n));
  return idx;
}

export function generateSlots(spec: CalendarSpec, quantity: number): GenerateResult {
  const D = allowedDatesInMonth(spec);
  const m = D.length;
  const slots: SlotPlan[] = [];

  if (quantity <= 0 || m === 0) {
    return { slots, carriedToNextMonth: Math.max(0, quantity) };
  }

  if (quantity <= m) {
    for (const i of evenIndices(m, quantity)) {
      slots.push({ date: D[i]!, orderInDay: 1, needsManualConfirm: false });
    }
    return { slots, carriedToNextMonth: 0 };
  }

  // quantity > m: сите денови orderInDay=1, вишокот orderInDay=2 (ако е дозволено).
  for (const date of D) slots.push({ date, orderInDay: 1, needsManualConfirm: false });
  let extra = quantity - m;

  if (spec.allowTwoPerDay) {
    const place2 = Math.min(extra, m);
    for (const i of evenIndices(m, place2)) {
      slots.push({ date: D[i]!, orderInDay: 2, needsManualConfirm: true });
    }
    extra -= place2;
  }

  return { slots, carriedToNextMonth: extra };
}
