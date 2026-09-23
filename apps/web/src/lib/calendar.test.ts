import { describe, it, expect } from 'vitest';
import { buildMonthGrid, ymd, monthKeyOf, WEEKDAY_LABELS, MONTH_LABELS } from './calendar.js';

describe('calendar helpers', () => {
  it('ymd форматира како YYYY-MM-DD во UTC', () => {
    expect(ymd(new Date(Date.UTC(2026, 8, 5)))).toBe('2026-09-05');
    expect(ymd(new Date(Date.UTC(2026, 11, 31)))).toBe('2026-12-31');
  });

  it('monthKeyOf е 1-базиран месец со водечка нула', () => {
    expect(monthKeyOf(2026, 0)).toBe('2026-01');
    expect(monthKeyOf(2026, 8)).toBe('2026-09');
    expect(monthKeyOf(2026, 11)).toBe('2026-12');
  });

  it('WEEKDAY_LABELS почнува со понеделник (CLAUDE §4)', () => {
    expect(WEEKDAY_LABELS[0]).toBe('Пон');
    expect(WEEKDAY_LABELS[6]).toBe('Нед');
    expect(MONTH_LABELS).toHaveLength(12);
  });

  describe('buildMonthGrid', () => {
    it('секоја недела има точно 7 дена', () => {
      const grid = buildMonthGrid(2026, 8); // септември 2026
      for (const week of grid) expect(week).toHaveLength(7);
    });

    it('првиот ред почнува во понеделник', () => {
      const grid = buildMonthGrid(2026, 8);
      // 1 септември 2026 е вторник → редот почнува од понеделник 31 август
      expect(grid[0]?.[0]?.date.getUTCDay()).toBe(1); // понеделник
      expect(grid[0]?.[0]?.key).toBe('2026-08-31');
      expect(grid[0]?.[0]?.inMonth).toBe(false);
    });

    it('деновите во месецот се означени со inMonth=true', () => {
      const grid = buildMonthGrid(2026, 8);
      const first = grid.flat().find((c) => c.key === '2026-09-01');
      const last = grid.flat().find((c) => c.key === '2026-09-30');
      expect(first?.inMonth).toBe(true);
      expect(last?.inMonth).toBe(true);
    });

    it('деновите се последователни без прескок', () => {
      const flat = buildMonthGrid(2026, 8).flat();
      for (let i = 1; i < flat.length; i++) {
        const prev = flat[i - 1]!.date.getTime();
        const cur = flat[i]!.date.getTime();
        expect(cur - prev).toBe(86_400_000);
      }
    });

    it('месец што почнува во понеделник го држи 1-ви во првата ќелија', () => {
      // јуни 2026 почнува во понеделник
      const grid = buildMonthGrid(2026, 5);
      expect(grid[0]?.[0]?.key).toBe('2026-06-01');
      expect(grid[0]?.[0]?.inMonth).toBe(true);
    });
  });
});
