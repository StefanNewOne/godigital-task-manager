// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.vite/**',
      '**/coverage/**',
      '**/.turbo/**',
      'packages/db/src/generated/**',
      'design_handoff_godigital_task_manager/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // INVARIANT (CLAUDE.md И2): статус се менува само преку state machine.
      // Директен Prisma update на `status` е забранет надвор од packages/core + api/src/services/workflow.
      // TODO(core): замени со наменско ESLint правило (@gd/eslint-plugin) што ја таргетира
      // `prisma.*.update({ data: { status } })` формата. Засега — code review го спроведува.
    },
  },
);
