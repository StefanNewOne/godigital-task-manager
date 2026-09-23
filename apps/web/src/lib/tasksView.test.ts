import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { daysUntil, fmtDate, relDate, bucketOf, daysInStatus } from './tasksView.js';
import type { TaskListItem } from './types.js';

// Фиксно „сега" за детерминистички релативни датуми.
const NOW = new Date('2026-09-23T12:00:00.000Z');

beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});
afterAll(() => {
  vi.useRealTimers();
});

function task(partial: Partial<TaskListItem>): TaskListItem {
  return {
    id: 't1',
    clientId: 'c1',
    groupId: 'g1',
    contentType: 'video',
    title: 'Тест',
    status: 'dizajn',
    assigneeId: null,
    priority: 'normal',
    version: 1,
    statusChangedAt: '2026-09-23T12:00:00.000Z',
    slot: null,
    _count: { comments: 0, publications: 0 },
    ...partial,
  };
}

describe('daysUntil', () => {
  it('враќа null за празен внес', () => {
    expect(daysUntil(null)).toBeNull();
    expect(daysUntil(undefined)).toBeNull();
  });
  it('брои цели денови во UTC', () => {
    expect(daysUntil('2026-09-23')).toBe(0);
    expect(daysUntil('2026-09-24')).toBe(1);
    expect(daysUntil('2026-09-30')).toBe(7);
    expect(daysUntil('2026-09-22')).toBe(-1);
    expect(daysUntil('2026-09-16')).toBe(-7);
  });
});

describe('fmtDate', () => {
  it('форматира DD.MM.YYYY', () => {
    expect(fmtDate('2026-09-05')).toBe('05.09.2026');
    expect(fmtDate('2026-12-31')).toBe('31.12.2026');
  });
  it('враќа тире за празно', () => {
    expect(fmtDate(null)).toBe('—');
  });
});

describe('relDate', () => {
  it('релативни ознаки до 7 дена', () => {
    expect(relDate('2026-09-23')).toBe('денес');
    expect(relDate('2026-09-24')).toBe('утре');
    expect(relDate('2026-09-22')).toBe('вчера');
    expect(relDate('2026-09-25')).toBe('за 2 дена');
    expect(relDate('2026-09-30')).toBe('за 7 дена');
    expect(relDate('2026-09-21')).toBe('пред 2 дена');
  });
  it('надвор од 7 дена → апсолутен датум', () => {
    expect(relDate('2026-10-01')).toBe('01.10.2026');
    expect(relDate('2026-09-15')).toBe('15.09.2026');
  });
  it('тире за празно', () => {
    expect(relDate(null)).toBe('—');
  });
});

describe('bucketOf', () => {
  it('терминални/во-тек статуси → inProgress без оглед на слот', () => {
    expect(bucketOf(task({ status: 'objaveno', slot: null }))).toBe('inProgress');
    expect(bucketOf(task({ status: 'zavrseno' }))).toBe('inProgress');
  });
  it('без слот датум → inProgress', () => {
    expect(bucketOf(task({ status: 'dizajn', slot: null }))).toBe('inProgress');
  });
  it('минат датум → overdue', () => {
    expect(
      bucketOf(
        task({ status: 'dizajn', slot: { date: '2026-09-20', orderInDay: 1, status: 'reserved' } }),
      ),
    ).toBe('overdue');
  });
  it('денес/утре → todayTomorrow', () => {
    expect(
      bucketOf(
        task({ status: 'dizajn', slot: { date: '2026-09-24', orderInDay: 1, status: 'reserved' } }),
      ),
    ).toBe('todayTomorrow');
  });
  it('до 7 дена → soon, подоцна → later', () => {
    expect(
      bucketOf(
        task({ status: 'dizajn', slot: { date: '2026-09-29', orderInDay: 1, status: 'reserved' } }),
      ),
    ).toBe('soon');
    expect(
      bucketOf(
        task({ status: 'dizajn', slot: { date: '2026-10-15', orderInDay: 1, status: 'reserved' } }),
      ),
    ).toBe('later');
  });
});

describe('daysInStatus', () => {
  it('денови поминати во тековен статус (апсолутно)', () => {
    expect(daysInStatus(task({ statusChangedAt: '2026-09-20T00:00:00.000Z' }))).toBe(3);
    expect(daysInStatus(task({ statusChangedAt: '2026-09-23T00:00:00.000Z' }))).toBe(0);
  });
});
