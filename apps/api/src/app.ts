import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import pinoHttp from 'pino-http';
import { env } from './env.js';
import { errorMiddleware } from './lib/errors.js';
import { idempotency } from './middleware/idempotency.js';
import { apiRouter } from './routes/index.js';
import { webhookRouter } from './routes/webhooks.js';

/** Express апликацијата без `listen` — за тестови (supertest) и за index.ts. */
export function createApp(): Express {
  const app = express();

  app.use(pinoHttp({ enabled: env.NODE_ENV !== 'test' }));
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  // Зачувај го суровото тело за webhook потпис (X-Hub-Signature-256, §7).
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
      },
    }),
  );
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'gd-api' });
  });

  // Webhooks — без JWT/idempotency (Meta повикува без сесија). Мора пред /api.
  app.use('/api/webhooks', webhookRouter);
  app.use('/api', idempotency, apiRouter);
  app.use(errorMiddleware);

  return app;
}
