import { describe, expect, it } from 'vitest';
import { TASK_TRANSITIONS, GROUP_TRANSITIONS } from '@gd/core';

/**
 * G2 — токен-комплетност на state-machine матрицата (CLAUDE.md §3/§13).
 *
 * `runTaskGuards`/effect-runner-ите имаат `default: no-op` за непознат токен, па typo или НОВ
 * `G_*`/`E_*` токен во матрицата би бил тивок no-op — guard што не гати, effect што не се
 * извршува. Овој тест го фаќа тоа на CI: секој токен во матрицата МОРА да е или имплементиран
 * хендлер, или експлицитно документиран „декларативен" за ТОЈ runner (структурен/inline/одложен).
 *
 * Множествата се одржуваат во синхрон со switch-евите: guards.ts · effects.ts · groupTransition.ts.
 * Контекстот е важен: ист токен може да е имплементиран во таск-runner-от, а декларативен во
 * груп-runner-от (пр. `E_REVISION` — task има хендлер, group е одложен).
 */

// ── Имплементирани хендлери (извршуваат вистинска логика) ──
const TASK_GUARD_HANDLERS = new Set([
  'G_ASSIGNEE_REQUIRED',
  'G_CLIENT_OUTCOME',
  'G_COMMENT',
  'G_COMMENT_IF_CHANGES',
  'G_DECISION',
  'G_FILE',
  'G_NOT_SELF_APPROVAL',
  'G_PUBLICATION',
  'G_TEXT',
]);
const TASK_EFFECT_HANDLERS = new Set([
  'E_ALARM',
  'E_APPROVAL',
  'E_ASSIGN',
  'E_AUTO_NEXT',
  'E_CLOSE_GROUP_IF_FIRST',
  'E_NOTIFY',
  'E_REVISION',
  'E_VERSION_BUMP',
]);
const GROUP_GUARD_HANDLERS = new Set([
  'G_AT_LEAST_ONE_APPROVED',
  'G_CAPA_FIELDS',
  'G_COMMENT',
  'G_FILE',
  'G_FIRST_CHILD_IN_BRIFING',
  'G_SCENARIO_OUTCOMES',
  'G_SCENARIOS_SPLIT',
]);
const GROUP_EFFECT_HANDLERS = new Set([
  'E_ACTIVATE_CHILDREN',
  'E_ALARM',
  'E_ASSIGN',
  'E_CLOSE_GROUP',
  'E_NOTIFY',
  'E_STORAGE_TIMER',
  'E_VERSION_BUMP',
]);

// ── Декларативни токени — присутни во матрицата, но НЕ ги извршува соодветниот runner (намерно) ──
const TASK_DECLARATIVE = new Map<string, string>([
  ['G_CAPA_IN_SNIMANJE', 'системски ред mrtov→cekaSnimanje; активацијата иде преку групата'],
  ['G_SCENARIO_BOUND', 'системски ред; врзувањето сценарио е дел од activateVideoChildren'],
  ['G_CAPA_CLOSED', 'системски ред cekaSnimanje→chekaRezija; групата го носи условот'],
  ['E_BIND_SCENARIOS', 'системски ред; реализирано во activateVideoChildren'],
  ['E_SCHEDULE_METRICS', 'одложено за Фаза B2 (метрики worker)'],
]);
const GROUP_DECLARATIVE = new Map<string, string>([
  ['E_BIND_SCENARIOS', 'реализирано inline во activateVideoChildren (преку E_ACTIVATE_CHILDREN)'],
  ['E_CREATE_EXTRA_SLOTS', 'реализирано inline во activateVideoChildren (+ аларм 9)'],
  ['E_APPROVAL', 'per-scenario одобрување се води преку Scenario.status (setScenarioOutcomes)'],
  ['E_REVISION', 'документ-ревизија на група — одложено (B/подоцна), scenKajKlient→scenarija'],
]);

/** 'G_TEXT(brief,50)' | 'E_AUTO_NEXT(analitika)?' → 'G_TEXT' | 'E_AUTO_NEXT' */
function tokenName(raw: string): string {
  return raw
    .replace(/\(.*\)/, '')
    .replace(/\?$/, '')
    .trim();
}

function collect(
  rules: ReadonlyArray<{ guards?: readonly string[]; effects?: readonly string[] }>,
  kind: 'guards' | 'effects',
): Set<string> {
  const out = new Set<string>();
  for (const r of rules) for (const t of r[kind] ?? []) out.add(tokenName(t));
  return out;
}

function unknowns(tokens: Set<string>, handlers: Set<string>, declarative: Map<string, string>) {
  return [...tokens].filter((t) => !handlers.has(t) && !declarative.has(t));
}

const taskGuardTokens = collect(TASK_TRANSITIONS, 'guards');
const taskEffectTokens = collect(TASK_TRANSITIONS, 'effects');
const groupGuardTokens = collect(GROUP_TRANSITIONS, 'guards');
const groupEffectTokens = collect(GROUP_TRANSITIONS, 'effects');

describe('G2 · state-machine токен-комплетност', () => {
  it('сите task guards имаат хендлер или се декларативни', () => {
    expect(unknowns(taskGuardTokens, TASK_GUARD_HANDLERS, TASK_DECLARATIVE)).toEqual([]);
  });

  it('сите task effects имаат хендлер или се декларативни', () => {
    expect(unknowns(taskEffectTokens, TASK_EFFECT_HANDLERS, TASK_DECLARATIVE)).toEqual([]);
  });

  it('сите group guards имаат хендлер или се декларативни', () => {
    expect(unknowns(groupGuardTokens, GROUP_GUARD_HANDLERS, GROUP_DECLARATIVE)).toEqual([]);
  });

  it('сите group effects имаат хендлер или се декларативни', () => {
    expect(unknowns(groupEffectTokens, GROUP_EFFECT_HANDLERS, GROUP_DECLARATIVE)).toEqual([]);
  });

  it('нема застарен декларативен токен (секој се користи во својот контекст)', () => {
    const taskAll = new Set([...taskGuardTokens, ...taskEffectTokens]);
    const groupAll = new Set([...groupGuardTokens, ...groupEffectTokens]);
    expect([...TASK_DECLARATIVE.keys()].filter((t) => !taskAll.has(t))).toEqual([]);
    expect([...GROUP_DECLARATIVE.keys()].filter((t) => !groupAll.has(t))).toEqual([]);
  });
});
