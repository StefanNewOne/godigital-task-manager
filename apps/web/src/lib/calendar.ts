export interface DayCell {
  date: Date;
  inMonth: boolean;
  key: string; // 'YYYY-MM-DD'
}

export const WEEKDAY_LABELS = ['Пон', 'Вто', 'Сре', 'Чет', 'Пет', 'Саб', 'Нед'];

export const MONTH_LABELS = [
  'Јануари',
  'Февруари',
  'Март',
  'Април',
  'Мај',
  'Јуни',
  'Јули',
  'Август',
  'Септември',
  'Октомври',
  'Ноември',
  'Декември',
];

export function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function monthKeyOf(year: number, month0: number): string {
  return `${year}-${String(month0 + 1).padStart(2, '0')}`;
}

/** Месечна мрежа, понеделник прв. Води и денови од соседни месеци за пополнување. */
export function buildMonthGrid(year: number, month0: number): DayCell[][] {
  const first = new Date(Date.UTC(year, month0, 1));
  const isoFirst = first.getUTCDay() === 0 ? 7 : first.getUTCDay(); // 1..7
  const start = new Date(Date.UTC(year, month0, 1 - (isoFirst - 1)));

  const weeks: DayCell[][] = [];
  const cursor = new Date(start);
  for (let w = 0; w < 6; w++) {
    const week: DayCell[] = [];
    for (let d = 0; d < 7; d++) {
      week.push({
        date: new Date(cursor),
        inMonth: cursor.getUTCMonth() === month0,
        key: ymd(cursor),
      });
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
    weeks.push(week);
    // прекрати ако следната недела е целосно во следен месец
    if (cursor.getUTCMonth() !== month0 && w >= 3) break;
  }
  return weeks;
}
