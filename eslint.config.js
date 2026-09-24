// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';
import gd from '@gd/eslint-plugin';

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
    },
  },
  // INVARIANT (CLAUDE.md И2): Task/TaskGroup статусот се менува само преку state machine.
  // Наменско правило што ја фаќа `<x>.task|taskGroup.update|updateMany|upsert` со `data.status`.
  {
    files: ['apps/**/*.ts', 'packages/**/*.ts'],
    ignores: [
      // Единствениот легитимен писувач — самиот state machine.
      'apps/api/src/services/workflow/**',
      // Тестови и seed легитимно поставуваат состојба.
      '**/*.test.ts',
      '**/__tests__/**',
      'packages/db/prisma/**',
    ],
    plugins: { '@gd': gd },
    rules: {
      '@gd/no-task-status-write': 'error',
    },
  },
);
