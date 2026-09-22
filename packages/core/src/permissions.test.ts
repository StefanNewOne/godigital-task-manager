import { describe, expect, it } from 'vitest';
import { ROLES } from './roles.js';
import { PERMISSIONS, canChangeDate, canCreate, canSeeScreen } from './permissions.js';

describe('permissions', () => {
  it('секоја улога има запис', () => {
    for (const role of ROLES) {
      expect(PERMISSIONS[role]).toBeDefined();
      expect(PERMISSIONS[role].nav.length).toBeGreaterThan(0);
    }
  });

  it('само Директор гледа Админ', () => {
    expect(canSeeScreen('dir', 'admin')).toBe(true);
    expect(canSeeScreen('am', 'admin')).toBe(false);
    expect(canSeeScreen('rez', 'admin')).toBe(false);
  });

  it('само rez создава видео, само krea создава графика', () => {
    expect(canCreate('rez', 'video')).toBe(true);
    expect(canCreate('rez', 'graphic')).toBe(false);
    expect(canCreate('krea', 'graphic')).toBe(true);
    expect(canCreate('krea', 'video')).toBe(false);
    expect(canCreate('am', 'video')).toBe(false);
  });

  it('canChangeDate: dir двете, rez само видео, krea само графика, scen ниедна', () => {
    expect(canChangeDate('dir', 'video')).toBe(true);
    expect(canChangeDate('dir', 'graphic')).toBe(true);
    expect(canChangeDate('rez', 'video')).toBe(true);
    expect(canChangeDate('rez', 'graphic')).toBe(false);
    expect(canChangeDate('krea', 'graphic')).toBe(true);
    expect(canChangeDate('scen', 'video')).toBe(false);
  });

  it('scope: rez/krea/am/ana/dir = all; scen/kam/mon/diz = own', () => {
    expect(PERMISSIONS.rez.scope).toBe('all');
    expect(PERMISSIONS.krea.scope).toBe('all');
    expect(PERMISSIONS.dir.scope).toBe('all');
    expect(PERMISSIONS.scen.scope).toBe('own');
    expect(PERMISSIONS.mon.scope).toBe('own');
    expect(PERMISSIONS.diz.scope).toBe('own');
  });

  it('am ја носи zaObjavuvanje; mon ја носи montaza', () => {
    expect(PERMISSIONS.am.ownsTaskStatuses).toContain('zaObjavuvanje');
    expect(PERMISSIONS.mon.ownsTaskStatuses).toContain('montaza');
    expect(PERMISSIONS.rez.ownsCapaStatuses).toContain('podgotovka');
    expect(PERMISSIONS.scen.ownsCapaStatuses).toContain('scenarija');
  });
});
