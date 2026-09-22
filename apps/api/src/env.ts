import { z } from 'zod';

/**
 * Env валидација (CLAUDE.md §11): апликацијата ОДБИВА да стартува ако недостасува задолжителна.
 * Сите секрети доаѓаат од .env.* — никогаш hardcoded.
 */
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TZ: z.string().default('Europe/Skopje'),
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('30d'),
  DEFAULT_TENANT_ID: z.string().default('godigital'),
  API_PORT: z.coerce.number().default(3001),
  WEB_ORIGIN: z.string().url().default('http://localhost:5173'),
  CRON_SECRET: z.string().min(8).default('dev-cron-secret-change-me'),
  // Object storage (Cloudflare R2 / S3-compatible; MinIO локално)
  R2_ENDPOINT: z.string().url().default('http://localhost:9100'),
  R2_REGION: z.string().default('auto'),
  R2_ACCESS_KEY_ID: z.string().default('minioadmin'),
  R2_SECRET_ACCESS_KEY: z.string().default('minioadmin'),
  R2_BUCKET: z.string().default('godigital'),
});

export type Env = z.infer<typeof schema>;

export const env: Env = (() => {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Невалидна env конфигурација:', parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
})();
