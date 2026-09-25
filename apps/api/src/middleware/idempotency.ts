import type { NextFunction, Request, Response } from 'express';
import type { Prisma } from '@gd/db';
import { prisma } from '../db/tenantExtension.js';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Идемпотентност (Фаза C3): мутација со `Idempotency-Key` што веќе е видена го враќа
 * зачуваниот одговор — офлајн replay не дуплира ефекти. Best-effort (не го паѓа барањето).
 */
export async function idempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = req.header('Idempotency-Key');
  if (!key || !MUTATING.has(req.method)) {
    next();
    return;
  }
  try {
    const existing = await prisma.idempotencyKey.findUnique({ where: { key } });
    if (existing) {
      res.status(existing.statusCode).json(existing.responseBody);
      return;
    }
  } catch {
    // ако проверката падне, продолжи нормално
  }
  captureAndStore(key, res);
  next();
}

/** Чисти истечени idempotency клучеви (повикано од дневен cron). */
export async function purgeIdempotencyKeys(olderThanDays = 2): Promise<number> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - olderThanDays);
  const r = await prisma.idempotencyKey.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return r.count;
}

function captureAndStore(key: string, res: Response): void {
  const origJson = res.json.bind(res);
  res.json = (body: unknown) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      void prisma.idempotencyKey
        .create({
          data: { key, statusCode: res.statusCode, responseBody: body as Prisma.InputJsonValue },
        })
        .catch(() => undefined);
    }
    return origJson(body);
  };
}
