import { defineConfig } from 'vitest/config';

/** Интеграциски тестови — бараат жив Postgres (DATABASE_URL) + JWT env. */
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 30000,
    // Серски: сите фајлови делат една DB → без file-parallelism за да нема race.
    fileParallelism: false,
  },
});
