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
  // Email (alarm/kritichen). Локално = Mailhog (host порта 1135, без auth). Прод = вистински SMTP.
  SMTP_HOST: z.string().default('localhost'),
  SMTP_PORT: z.coerce.number().default(1135),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().default('GoDigital <no-reply@godigital.mk>'),
  EMAIL_ENABLED: z
    .enum(['true', 'false'])
    .default('true')
    .transform((v) => v === 'true'),
  // Meta Graph API (B2). Без токен → детерминистички stub адаптер (dev/тест). Никогаш на frontend.
  META_SYSTEM_TOKEN: z.string().optional(),
  META_GRAPH_VERSION: z.string().default('v21.0'),
  // Прегледи (B3). Без ffmpeg бинар → stub генератор (dev/тест).
  FFMPEG_PATH: z.string().optional(),
  // Квота на сторидж по клиент (GB) за аларм; висок default за да не алармира без потреба.
  STORAGE_QUOTA_GB: z.coerce.number().default(500),
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
