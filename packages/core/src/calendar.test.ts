import { describe, expect, it } from 'vitest';
import { groupByCombination, pickCalendar } from './calendar.js';

const PER = { id: 'per' };
const STD = { id: 'std' };

describe('pickCalendar', () => {
  it('specificen → посебен ако постои', () => {
    expect(pickCalendar('specificen', PER, STD)).toBe(PER);
  });

  it('specificen → fallback на стандарден ако нема посебен', () => {
    expect(pickCalendar('specificen', null, STD)).toBe(STD);
    expect(pickCalendar('specificen', undefined, STD)).toBe(STD);
  });

  it('standarden → стандарден ако постои', () => {
    expect(pickCalendar('standarden', PER, STD)).toBe(STD);
  });

  it('standarden → fallback на посебен ако нема стандарден', () => {
    expect(pickCalendar('standarden', PER, null)).toBe(PER);
  });

  it('ништо → null', () => {
    expect(pickCalendar('standarden', null, null)).toBeNull();
    expect(pickCalendar('specificen', undefined, undefined)).toBeNull();
  });
});

describe('groupByCombination', () => {
  const c = (id: string, v: number, g: number) => ({ id, videosPerMonth: v, graphicsPerMonth: g });

  it('групира по (видеа, графики) и сортира детерминистички', () => {
    const combos = groupByCombination([c('a', 4, 12), c('b', 2, 8), c('c', 4, 12), c('d', 2, 8)]);
    expect(combos).toHaveLength(2);
    expect(combos[0]).toMatchObject({ videos: 2, graphics: 8 });
    expect(combos[0]!.clients.map((x) => x.id)).toEqual(['b', 'd']);
    expect(combos[1]).toMatchObject({ videos: 4, graphics: 12 });
    expect(combos[1]!.clients.map((x) => x.id)).toEqual(['a', 'c']);
  });

  it('исти видеа, различни графики → сортира по графики', () => {
    const combos = groupByCombination([c('a', 4, 24), c('b', 4, 12)]);
    expect(combos.map((x) => x.graphics)).toEqual([12, 24]);
  });

  it('празен влез → празно', () => {
    expect(groupByCombination([])).toEqual([]);
  });
});
