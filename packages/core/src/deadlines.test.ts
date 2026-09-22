import { describe, expect, it } from 'vitest';
import { formatDeadlineLabel, subtractDays, taskDeadline } from './deadlines.js';

const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day));

describe('deadlines', () => {
  it('taskDeadline = publishDate − lead по default (видео montaza = 6)', () => {
    const publish = d(2026, 8, 20);
    expect(taskDeadline('montaza', 'video', publish)).toEqual(subtractDays(publish, 6));
  });

  it('taskDeadline враќа null за статус без рок', () => {
    expect(taskDeadline('pauza', 'video', d(2026, 8, 20))).toBeNull();
  });

  it('taskDeadline почитува override', () => {
    const publish = d(2026, 8, 20);
    expect(taskDeadline('montaza', 'video', publish, 3)).toEqual(subtractDays(publish, 3));
  });

  it('formatDeadlineLabel: еднина 1 ден, не 1 дена', () => {
    const today = d(2026, 8, 20);
    expect(formatDeadlineLabel(d(2026, 8, 21), today)).toEqual({
      text: 'рок утре',
      level: 'soon',
    });
    expect(formatDeadlineLabel(d(2026, 8, 20), today)).toEqual({
      text: 'рок денес',
      level: 'soon',
    });
    expect(formatDeadlineLabel(d(2026, 8, 23), today)).toEqual({
      text: 'рок за 3 дена',
      level: 'normal',
    });
    expect(formatDeadlineLabel(d(2026, 8, 19), today)).toEqual({
      text: 'рок пречекорен 1 ден',
      level: 'overdue',
    });
    expect(formatDeadlineLabel(d(2026, 8, 18), today)).toEqual({
      text: 'рок пречекорен 2 дена',
      level: 'overdue',
    });
  });
});
