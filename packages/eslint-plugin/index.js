// @ts-check
/**
 * @gd/eslint-plugin — наменски ESLint правила што ги спроведуваат тврдите инваријанти
 * од CLAUDE.md што генеричките правила не ги фаќаат.
 */
import noTaskStatusWrite from './rules/no-task-status-write.js';

const plugin = {
  meta: { name: '@gd/eslint-plugin', version: '0.0.0' },
  rules: {
    'no-task-status-write': noTaskStatusWrite,
  },
};

export default plugin;
