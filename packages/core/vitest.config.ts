import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      // packages/core = единствен извор на доменска логика → 100% (CLAUDE.md §13).
      // Недостижните дефанзивни гранки (пр. `?? null` под noUncheckedIndexedAccess)
      // се означени со `/* v8 ignore */` + образложение, не се спуштаат праговите.
      thresholds: {
        statements: 100,
        branches: 100,
        functions: 100,
        lines: 100,
      },
    },
  },
});
