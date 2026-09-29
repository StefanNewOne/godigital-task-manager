import { describe, expect, it } from 'vitest';
import { t, plural } from '@gd/ui';

/** i18n runtime (CLAUDE.md §4) — lookup + интерполација + македонски плурал. */
describe('i18n · t()', () => {
  it('чита постоечки клуч по точка-патека', () => {
    expect(t('common.save')).toBe('Зачувај');
    expect(t('nav.analytics')).toBe('Аналитика');
  });

  it('враќа го клучот ако недостасува (dev сигнал)', () => {
    expect(t('nema.vakov.kluc')).toBe('nema.vakov.kluc');
  });

  it('интерполира {var}', () => {
    expect(t('meta.topbar.freshness', { time: '14:30' })).toBe('Освежено: 14:30');
  });

  it('ICU plural од mk.json (one/other + # замена)', () => {
    expect(t('plural.day', { count: 1 })).toBe('1 ден');
    expect(t('plural.day', { count: 5 })).toBe('5 дена');
    // task има one/few/other
    expect(t('plural.task', { count: 1 })).toBe('1 таск');
    expect(t('plural.task', { count: 3 })).toBe('3 таска');
    expect(t('plural.task', { count: 8 })).toBe('8 таскови');
  });

  it('ICU plural внатре во текст (deadline)', () => {
    expect(t('deadline.future', { count: 2 })).toBe('рок за 2 дена');
    expect(t('deadline.future', { count: 1 })).toBe('рок за 1 ден');
  });
});

describe('i18n · plural() — македонски CLDR', () => {
  it('one: 1, 21, 101 (n%10==1 и n%100!=11)', () => {
    const f = { one: '# ден', other: '# дена' };
    expect(plural(1, f)).toBe('1 ден');
    expect(plural(21, f)).toBe('21 ден');
    expect(plural(101, f)).toBe('101 ден');
  });

  it('other: 0, 5, 11, 111', () => {
    const f = { one: '# ден', other: '# дена' };
    expect(plural(0, f)).toBe('0 дена');
    expect(plural(5, f)).toBe('5 дена');
    expect(plural(11, f)).toBe('11 дена'); // 11 е исклучок → other
    expect(plural(111, f)).toBe('111 дена');
  });
});
