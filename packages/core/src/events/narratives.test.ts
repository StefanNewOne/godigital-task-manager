import { describe, expect, it } from 'vitest';
import { EVENT_TYPES, isKnownEventType } from './narratives.js';

describe('G3 · каталог на настани', () => {
  it('EVENT_TYPES е непразен и без дупликати', () => {
    expect(EVENT_TYPES.length).toBeGreaterThan(0);
    expect(new Set(EVENT_TYPES).size).toBe(EVENT_TYPES.length);
  });

  it('секој eventType е непразен dot-намеспејсен стринг', () => {
    for (const t of EVENT_TYPES) {
      expect(t.trim()).not.toBe('');
      expect(t).toMatch(/^[a-zA-Z]+\.[a-zA-Z._]+$/);
    }
  });

  it('isKnownEventType препознава каталогизиран и одбива непознат', () => {
    expect(isKnownEventType('task.transition')).toBe(true);
    expect(isKnownEventType('meta.plan.approved')).toBe(true);
    expect(isKnownEventType('nepostoi.nastan')).toBe(false);
    expect(isKnownEventType('')).toBe(false);
  });
});
