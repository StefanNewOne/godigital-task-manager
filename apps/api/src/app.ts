import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import type { Express } from 'express';
import pinoHttp from 'pino-http';
import { env } from './env.js';
import { errorMiddleware } from './lib/errors.js';
import { idempotency } from './middleware/idempotency.js';
import { apiRouter } from './routes/index.js';

/** Express апликацијата без `listen` — за тестови (supertest) и за index.ts. */
export function createApp(): Express {
  const app = express();

  app.use(pinoHttp({ enabled: env.NODE_ENV !== 'test' }));
  app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'gd-api' });
  });

  app.use('/api', idempotency, apiRouter);
  app.use(errorMiddleware);

  return app;
}
