/**
 * Генератор на `transitions.fixture.json` (CLAUDE.md §13, PRD §4.3).
 *
 * Фикстурот е committed, човек-прегледлив снимок на state-machine матрицата. `transitions.fixture.test.ts`
 * потврдува дека живата матрица е ИДЕНТИЧНА со фикстурот — ако PR ја менува матрицата без да го
 * регенерира фикстурот, тестот паѓа (спроведува го §10 „workflow-change мора да го ажурира
 * transitions.fixture.json"). Истиот фикстур го чита processDoc за ботот и Админ → Автоматизации.
 *
 * Регенерирај по промена на матрицата:  tsx packages/core/scripts/gen-transitions-fixture.ts
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  TASK_TRANSITIONS,
  GROUP_TRANSITIONS,
  serializeMatrix,
} from '../src/workflow/transitions.js';

const out = fileURLToPath(new URL('../src/workflow/transitions.fixture.json', import.meta.url));
const fixture = serializeMatrix(TASK_TRANSITIONS, GROUP_TRANSITIONS);
writeFileSync(out, JSON.stringify(fixture, null, 2) + '\n', 'utf8');
// eslint-disable-next-line no-console
console.log(`wrote ${fixture.task.length} task + ${fixture.group.length} group rows → ${out}`);
