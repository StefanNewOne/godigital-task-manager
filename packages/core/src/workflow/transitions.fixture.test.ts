import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  TASK_TRANSITIONS,
  GROUP_TRANSITIONS,
  findTaskTransition,
  findGroupTransition,
  serializeMatrix,
  type SerializedMatrix,
} from './transitions.js';
import type { ContentType } from '../roles.js';

/**
 * G1 — табеларен тест на матрицата против committed `transitions.fixture.json` (CLAUDE.md §13, PRD §4.3).
 *
 * Фикстурот е човек-прегледлив снимок на СЕКОЈ ред од матрицата. Овој тест потврдува дека живата
 * матрица е идентична со фикстурот — ако PR ја менува матрицата без `tsx packages/core/scripts/
 * gen-transitions-fixture.ts`, тестот паѓа (спроведува §10: workflow-change мора да го ажурира
 * фикстурот + PRD). Дополнително: секој ред е разрешлив преку finder-ите и нема дупликати.
 */
const fixture = JSON.parse(
  readFileSync(new URL('./transitions.fixture.json', import.meta.url), 'utf8'),
) as SerializedMatrix;

const concrete = (c: string): ContentType => (c === 'graphic' ? 'graphic' : 'video');

describe('G1 · матрица ↔ transitions.fixture.json', () => {
  it('живата матрица е идентична со committed фикстурот (регенерирај ако паѓа)', () => {
    expect(serializeMatrix(TASK_TRANSITIONS, GROUP_TRANSITIONS)).toEqual(fixture);
  });

  it('фикстурот покрива реален број редови (не е празен)', () => {
    expect(fixture.task.length).toBe(TASK_TRANSITIONS.length);
    expect(fixture.group.length).toBe(GROUP_TRANSITIONS.length);
    expect(fixture.task.length).toBeGreaterThan(0);
    expect(fixture.group.length).toBeGreaterThan(0);
  });

  it('секој task ред од фикстурот е разрешлив и актерот се совпаѓа', () => {
    for (const row of fixture.task) {
      const rule = findTaskTransition(row.from, row.to, concrete(row.contentType));
      expect(rule, `${row.from}→${row.to} (${row.contentType})`).toBeDefined();
      expect(rule!.actor).toBe(row.actor);
      expect(rule!.guards).toEqual(row.guards);
    }
  });

  it('секој group ред од фикстурот е разрешлив и актерот се совпаѓа', () => {
    for (const row of fixture.group) {
      const rule = findGroupTransition(row.from, row.to, concrete(row.contentType));
      expect(rule, `${row.from}→${row.to} (${row.contentType})`).toBeDefined();
      expect(rule!.actor).toBe(row.actor);
      expect(rule!.guards).toEqual(row.guards);
    }
  });

  it('нема дупликат (from,to,contentType) во матрицата', () => {
    const taskKeys = TASK_TRANSITIONS.map((r) => `${r.from}|${r.to}|${r.contentType}`);
    const groupKeys = GROUP_TRANSITIONS.map((r) => `${r.from}|${r.to}|${r.contentType}`);
    expect(new Set(taskKeys).size).toBe(taskKeys.length);
    expect(new Set(groupKeys).size).toBe(groupKeys.length);
  });
});
