import { describe, expect, it } from 'vitest';
import {
  type CalendarSpec,
  allowedDatesInMonth,
  evenIndices,
  generateSlots,
  isoWeekday,
  ymd,
} from './algorithm.js';

const noHolidays = new Set<string>();

describe('slot algorithm', () => {
  it('isoWeekday: недела=7, понеделник=1', () => {
    expect(isoWeekday(new Date(Date.UTC(2026, 8, 6)))).toBe(7); // 6 сеп 2026 = недела
    expect(isoWeekday(new Date(Date.UTC(2026, 8, 7)))).toBe(1); // понеделник
  });

  it('evenIndices: 4 во 9 → [1,3,5,7] (PRD пример)', () => {
    expect(evenIndices(9, 4)).toEqual([1, 3, 5, 7]);
  });

  it('allowedDatesInMonth: вторници/петоци во септември минус празници', () => {
    const spec: CalendarSpec = {
      year: 2026,
      month0: 8, // септември
      weekdays: [2, 5], // вт, пет
      holidays: new Set(['2026-09-11']), // петок 11 сеп исклучен
      allowTwoPerDay: false,
    };
    const dates = allowedDatesInMonth(spec).map(ymd);
    expect(dates).toContain('2026-09-01'); // вторник
    expect(dates).toContain('2026-09-04'); // петок
    expect(dates).not.toContain('2026-09-11'); // празник
    expect(dates.every((d) => [2, 5].includes(isoWeekday(new Date(d + 'T00:00:00Z'))))).toBe(true);
  });

  it('quantity ≤ m: рамномерно распоредување, orderInDay=1', () => {
    const spec: CalendarSpec = {
      year: 2026,
      month0: 8,
      weekdays: [1, 2, 3, 4, 5], // работни денови
      holidays: noHolidays,
      allowTwoPerDay: false,
    };
    const r = generateSlots(spec, 4);
    expect(r.slots).toHaveLength(4);
    expect(r.carriedToNextMonth).toBe(0);
    expect(r.slots.every((s) => s.orderInDay === 1 && !s.needsManualConfirm)).toBe(true);
    // датумите се растечки и уникатни
    const times = r.slots.map((s) => s.date.getTime());
    expect([...times].sort((a, b) => a - b)).toEqual(times);
  });

  it('quantity > m со allowTwoPerDay: втор пост orderInDay=2 + рачна потврда', () => {
    const spec: CalendarSpec = {
      year: 2026,
      month0: 8,
      weekdays: [2], // само вторници → 5 вторници во сеп 2026 (1,8,15,22,29)
      holidays: noHolidays,
      allowTwoPerDay: true,
    };
    const m = allowedDatesInMonth(spec).length;
    const r = generateSlots(spec, m + 2);
    expect(r.slots.filter((s) => s.orderInDay === 1)).toHaveLength(m);
    const second = r.slots.filter((s) => s.orderInDay === 2);
    expect(second).toHaveLength(2);
    expect(second.every((s) => s.needsManualConfirm)).toBe(true);
    expect(r.carriedToNextMonth).toBe(0);
  });

  it('quantity > m без allowTwoPerDay: вишокот се пренесува', () => {
    const spec: CalendarSpec = {
      year: 2026,
      month0: 8,
      weekdays: [2],
      holidays: noHolidays,
      allowTwoPerDay: false,
    };
    const m = allowedDatesInMonth(spec).length;
    const r = generateSlots(spec, m + 3);
    expect(r.slots).toHaveLength(m);
    expect(r.carriedToNextMonth).toBe(3);
  });

  it('quantity > 2m со allowTwoPerDay: вишокот над 2m се пренесува', () => {
    const spec: CalendarSpec = {
      year: 2026,
      month0: 8,
      weekdays: [2],
      holidays: noHolidays,
      allowTwoPerDay: true,
    };
    const m = allowedDatesInMonth(spec).length;
    const r = generateSlots(spec, 2 * m + 1);
    expect(r.slots).toHaveLength(2 * m);
    expect(r.carriedToNextMonth).toBe(1);
  });

  it('нула количина или нема денови → сè се пренесува', () => {
    const spec: CalendarSpec = {
      year: 2026,
      month0: 8,
      weekdays: [],
      holidays: noHolidays,
      allowTwoPerDay: false,
    };
    expect(generateSlots(spec, 4).carriedToNextMonth).toBe(4);
    expect(generateSlots({ ...spec, weekdays: [2] }, 0).carriedToNextMonth).toBe(0);
  });
});
