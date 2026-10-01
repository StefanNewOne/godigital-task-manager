import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

/** Интеграциски тестови — бараат жив Postgres (DATABASE_URL) + JWT env. */
export default defineConfig({
  // @gd/db извезува dist во прод (TD-1); тестовите го користат src директно.
  resolve: {
    alias: {
      '@gd/db': fileURLToPath(new URL('../../packages/db/src/index.ts', import.meta.url)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.integration.test.ts'],
    testTimeout: 30000,
    // Серски: сите фајлови делат една DB → без file-parallelism за да нема race.
    fileParallelism: false,
  },
});
