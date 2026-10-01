import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import { configDefaults } from 'vitest/config';

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
    // Default: unit тестови. Интеграциските (*.integration.test.ts) бараат жив Postgres +
    // JWT env, па се исклучени тука и се пуштаат со `pnpm --filter @gd/api test:integration`.
    include: ['src/**/*.test.ts'],
    exclude: [...configDefaults.exclude, '**/*.integration.test.ts'],
  },
});
