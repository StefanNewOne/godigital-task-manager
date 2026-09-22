import { describe, expect, it } from 'vitest';
import {
  ALL_STATUSES,
  TASK_STATUS_META,
  isTerminal,
  isWorkZoneLockable,
  ownerOf,
} from './statuses.js';

describe('statuses', () => {
  it('ALL_STATUSES го содржи точниот редослед од PRD §4.1', () => {
    expect(ALL_STATUSES).toEqual([
      'mrtov',
      'cekaSnimanje',
      'brifing',
      'dizajn',
      'chekaRezija',
      'montaza',
      'vnatresno',
      'kajKlient',
      'zaObjavuvanje',
      'objaveno',
      'analitika',
      'zavrseno',
      'pauza',
      'otkazano',
    ]);
  });

  it('секој статус има мета со етикета', () => {
    for (const s of ALL_STATUSES) {
      expect(TASK_STATUS_META[s].label.length).toBeGreaterThan(0);
    }
  });

  it('ownerOf разрешува зависност од тип за vnatresno/kajKlient', () => {
    expect(ownerOf('vnatresno', 'video')).toBe('rez');
    expect(ownerOf('vnatresno', 'graphic')).toBe('krea');
    expect(ownerOf('kajKlient', 'video')).toBe('rez');
    expect(ownerOf('kajKlient', 'graphic')).toBe('krea');
    expect(ownerOf('montaza', 'video')).toBe('mon');
    expect(ownerOf('mrtov', 'video')).toBeNull();
  });

  it('objaveno е терминален само без Meta Ads (D-6)', () => {
    expect(isTerminal('objaveno', false)).toBe(true);
    expect(isTerminal('objaveno', true)).toBe(false);
    expect(isTerminal('zavrseno', true)).toBe(true);
    expect(isTerminal('otkazano', false)).toBe(true);
    expect(isTerminal('montaza', false)).toBe(false);
  });

  it('терминалите и пауза/резервиран не се заклучуваат', () => {
    expect(isWorkZoneLockable('montaza')).toBe(true);
    expect(isWorkZoneLockable('objaveno')).toBe(false);
    expect(isWorkZoneLockable('pauza')).toBe(false);
    expect(isWorkZoneLockable('mrtov')).toBe(false);
  });
});
