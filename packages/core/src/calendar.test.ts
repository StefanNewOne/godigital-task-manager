import { describe, expect, it } from 'vitest';
import { pickCalendar } from './calendar.js';

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
