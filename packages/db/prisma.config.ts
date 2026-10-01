import { defineConfig } from 'prisma/config';

/**
 * Prisma конфигурација (TD-2). Ја заменува deprecated `package.json#prisma` (Prisma 7-ready).
 * НАПОМЕНА: со prisma.config.ts, Prisma НЕ вчитува `.env` автоматски — `DATABASE_URL` доаѓа од
 * process.env (CI го поставува како job env; локално `set -a && source .env.local`).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
