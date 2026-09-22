import { describe, expect, it } from 'vitest';
import { TASK_STATUSES } from '../statuses.js';
import {
  GROUP_TRANSITIONS,
  TASK_TRANSITIONS,
  allowedTaskTargets,
  findGroupTransition,
  findTaskTransition,
  isBoardDraggable,
} from './transitions.js';

const KNOWN = new Set<string>(TASK_STATUSES);

describe('task transition matrix', () => {
  it('секое правило референцира познати статуси', () => {
    for (const r of TASK_TRANSITIONS) {
      expect(KNOWN.has(r.from), `from ${r.from}`).toBe(true);
      expect(KNOWN.has(r.to), `to ${r.to}`).toBe(true);
    }
  });

  it('findTaskTransition наоѓа видео chekaRezija→montaza и бара внес', () => {
    const r = findTaskTransition('chekaRezija', 'montaza', 'video');
    expect(r).toBeDefined();
    expect(r?.requiresInput).toBe(true);
    expect(r?.actor).toBe('rez');
    expect(r?.guards).toContain('G_NOT_SELF_APPROVAL');
  });

  it('заеднички преод zaObjavuvanje→objaveno важи за двата типа', () => {
    expect(findTaskTransition('zaObjavuvanje', 'objaveno', 'video')).toBeDefined();
    expect(findTaskTransition('zaObjavuvanje', 'objaveno', 'graphic')).toBeDefined();
  });

  it('графички mrtov→brifing постои, видео mrtov→brifing не постои', () => {
    expect(findTaskTransition('mrtov', 'brifing', 'graphic')).toBeDefined();
    expect(findTaskTransition('mrtov', 'brifing', 'video')).toBeUndefined();
  });

  it('allowedTaskTargets за видео vnatresno = montaza + kajKlient', () => {
    expect(allowedTaskTargets('vnatresno', 'video').sort()).toEqual(['kajKlient', 'montaza']);
  });

  it('Board DnD: враќање во montaza не е дозволено (бара коментар)', () => {
    expect(isBoardDraggable('vnatresno', 'montaza', 'video')).toBe(false);
    // vnatresno→kajKlient нема input-guards → дозволено
    expect(isBoardDraggable('vnatresno', 'kajKlient', 'video')).toBe(true);
  });

  it('нема дупликат правило (from,to,contentType)', () => {
    const seen = new Set<string>();
    for (const r of TASK_TRANSITIONS) {
      const key = `${r.from}->${r.to}:${r.contentType}`;
      expect(seen.has(key), `дупликат ${key}`).toBe(false);
      seen.add(key);
    }
  });
});

describe('group transition matrix', () => {
  it('видео капа има целосен ланец podgotovka→…→zatvoren', () => {
    const targets = GROUP_TRANSITIONS.filter((r) => r.contentType === 'video').map(
      (r) => `${r.from}->${r.to}`,
    );
    expect(targets).toContain('podgotovka->scenarija');
    expect(targets).toContain('scenKajKlient->snimanje');
    expect(targets).toContain('snimanje->zatvoren');
  });

  it('графичка капа има само gPodgotovka→zatvoren', () => {
    const g = GROUP_TRANSITIONS.filter((r) => r.contentType === 'graphic');
    expect(g).toHaveLength(1);
    expect(g[0]?.from).toBe('gPodgotovka');
    expect(g[0]?.to).toBe('zatvoren');
  });

  it('findGroupTransition наоѓа постоечки и враќа undefined за непостоечки', () => {
    expect(findGroupTransition('gPodgotovka', 'zatvoren', 'graphic')).toBeDefined();
    expect(findGroupTransition('scenKajKlient', 'snimanje', 'video')).toBeDefined();
    expect(findGroupTransition('podgotovka', 'snimanje', 'video')).toBeUndefined();
  });
});
