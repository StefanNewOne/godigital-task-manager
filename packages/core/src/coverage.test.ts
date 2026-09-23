import { describe, expect, it } from 'vitest';
import {
  type CoverageTask,
  clientCoverage,
  coverageLevel,
  plannedCoverage,
  plannedUntil,
  readyCoverage,
} from './coverage.js';

const today = new Date(Date.UTC(2026, 8, 20)); // 20 сеп 2026 (референца од прототип)
const d = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day));

describe('coverage', () => {
  it('plannedCoverage = најдоцен не-мртов датум минус денес, floored 0', () => {
    const tasks: CoverageTask[] = [
      { status: 'dizajn', publishDate: d(2026, 8, 30) }, // +10
      { status: 'mrtov', publishDate: d(2026, 9, 15) }, // се игнорира
      { status: 'objaveno', publishDate: d(2026, 8, 25) },
    ];
    expect(plannedCoverage(tasks, today)).toBe(10);
  });

  it('plannedCoverage игнорира otkazano и pauza', () => {
    const tasks: CoverageTask[] = [
      { status: 'otkazano', publishDate: d(2026, 9, 30) },
      { status: 'pauza', publishDate: d(2026, 9, 25) },
      { status: 'montaza', publishDate: d(2026, 8, 27) }, // +7
    ];
    expect(plannedCoverage(tasks, today)).toBe(7);
  });

  it('plannedCoverage = 0 кога сè е во минато или нема', () => {
    expect(plannedCoverage([], today)).toBe(0);
    expect(plannedCoverage([{ status: 'objaveno', publishDate: d(2026, 8, 10) }], today)).toBe(0);
  });

  it('plannedUntil = најдоцниот испланиран датум (не floored), null ако нема', () => {
    const tasks: CoverageTask[] = [
      { status: 'dizajn', publishDate: d(2026, 8, 30) },
      { status: 'mrtov', publishDate: d(2026, 9, 15) }, // се игнорира
      { status: 'objaveno', publishDate: d(2026, 8, 25) },
    ];
    expect(plannedUntil(tasks)).toEqual(d(2026, 8, 30));
    expect(plannedUntil([])).toBeNull();
    expect(plannedUntil([{ status: 'mrtov', publishDate: d(2026, 9, 15) }])).toBeNull();
  });

  it('readyCoverage брои само За објавување или подоцна', () => {
    const tasks: CoverageTask[] = [
      { status: 'dizajn', publishDate: d(2026, 9, 30) }, // не се брои
      { status: 'zaObjavuvanje', publishDate: d(2026, 8, 25) }, // +5
    ];
    expect(readyCoverage(tasks, today)).toBe(5);
  });

  it('clientCoverage = најлошата линија, само типови со квота > 0', () => {
    const cov = clientCoverage(
      {
        video: { quota: 4, tasks: [{ status: 'montaza', publishDate: d(2026, 8, 30) }] }, // +10
        graphic: { quota: 8, tasks: [{ status: 'brifing', publishDate: d(2026, 8, 25) }] }, // +5
      },
      today,
    );
    expect(cov).toBe(5);
  });

  it('clientCoverage ги прескокнува типовите со квота 0', () => {
    const cov = clientCoverage(
      {
        video: { quota: 0, tasks: [] },
        graphic: { quota: 8, tasks: [{ status: 'brifing', publishDate: d(2026, 8, 28) }] }, // +8
      },
      today,
    );
    expect(cov).toBe(8);
  });

  it('coverageLevel прагови: >14 ok, 7–14 warn, <7 danger', () => {
    expect(coverageLevel(15)).toBe('ok');
    expect(coverageLevel(14)).toBe('warn');
    expect(coverageLevel(7)).toBe('warn');
    expect(coverageLevel(6)).toBe('danger');
    expect(coverageLevel(0)).toBe('danger');
  });
});
