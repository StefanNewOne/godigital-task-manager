import { describe, expect, it } from 'vitest';
import { clientActiveForDate, endOfMonthUtc } from './clientLifecycle.js';

describe('endOfMonthUtc', () => {
  it('враќа последен ден од месецот (23:59:59.999 UTC)', () => {
    expect(endOfMonthUtc(new Date('2026-09-20T10:00:00Z')).toISOString()).toBe(
      '2026-09-30T23:59:59.999Z',
    );
    expect(endOfMonthUtc(new Date('2026-02-01T00:00:00Z')).toISOString()).toBe(
      '2026-02-28T23:59:59.999Z',
    );
    expect(endOfMonthUtc(new Date('2028-02-15T00:00:00Z')).toISOString()).toBe(
      '2028-02-29T23:59:59.999Z',
    );
  });
});

describe('clientActiveForDate', () => {
  it('без deactivatedAt → секогаш активен', () => {
    expect(clientActiveForDate(null, new Date('2030-01-01T00:00:00Z'))).toBe(true);
    expect(clientActiveForDate(undefined, new Date('2020-01-01T00:00:00Z'))).toBe(true);
  });

  it('гасење на 20.09 → активен до 30.09, блокиран од 01.10', () => {
    const off = new Date('2026-09-20T09:00:00Z');
    expect(clientActiveForDate(off, new Date('2026-09-20T00:00:00Z'))).toBe(true);
    expect(clientActiveForDate(off, new Date('2026-09-30T23:59:59Z'))).toBe(true);
    expect(clientActiveForDate(off, new Date('2026-10-01T00:00:00Z'))).toBe(false);
    expect(clientActiveForDate(off, new Date('2026-11-15T00:00:00Z'))).toBe(false);
  });

  it('датум пред гасењето (истиот месец) е сепак активен', () => {
    const off = new Date('2026-09-20T09:00:00Z');
    expect(clientActiveForDate(off, new Date('2026-09-05T00:00:00Z'))).toBe(true);
  });
});
