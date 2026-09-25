import { describe, expect, it } from 'vitest';
import { dedupeKey, notificationChannels } from './notifications.js';

describe('notifications', () => {
  it('канали по ниво (D-12: SMS наместо Viber; push на секое ниво, C5)', () => {
    expect(notificationChannels('potsetnik')).toEqual(['system', 'push']);
    expect(notificationChannels('alarm')).toEqual(['system', 'email', 'push']);
    expect(notificationChannels('kritichen')).toEqual(['system', 'email', 'sms', 'push']);
  });

  it('dedupeKey ги комбинира настан, објект, примач, ден', () => {
    expect(dedupeKey('coverage_low', 'client1', 'emp1', '2026-09-22')).toBe(
      'coverage_low:client1:emp1:2026-09-22',
    );
  });
});
