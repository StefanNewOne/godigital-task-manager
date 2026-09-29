import type { NextFunction, Request, Response } from 'express';
import type { Prisma } from '@gd/db';
import { prisma } from '../db/tenantExtension.js';

const MUTATING = new Set(['POST', 'PATCH', 'PUT', 'DELETE']);

/**
 * Идемпотентност (Фаза C3): мутација со `Idempotency-Key` што веќе е видена го враќа
 * зачуваниот одговор — офлајн replay не дуплира ефекти. Best-effort (не го паѓа барањето).
 */
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function idempotency(req: Request, res: Response, next: NextFunction): Promise<void> {
  const key = req.header('Idempotency-Key');
  if (!key || !MUTATING.has(req.method)) {
    next();
    return;
  }

  // 1) Веќе завршен одговор → врати го кеширан.
  const existing = await prisma.idempotencyKey.findUnique({ where: { key } }).catch(() => null);
  if (existing && existing.statusCode > 0) {
    res.status(existing.statusCode).json(existing.responseBody);
    return;
  }

  // 2) Резервирај го клучот АТОМСКИ (unique constraint = дедуп-брава). Спречува race каде брз
  //    следен барател проаѓа пред одговорот да се запише. statusCode=0 = „во обработка".
  const reserved =
    !existing &&
    (await prisma.idempotencyKey
      .create({ data: { key, statusCode: 0, responseBody: {} } })
      .then(() => true)
      .catch(() => false));

  if (!reserved) {
    // Друг барател обработува → чекај го одговорот (до ~2s), па врати го кеширан.
    for (let i = 0; i < 40; i++) {
      const done = await prisma.idempotencyKey.findUnique({ where: { key } }).catch(() => null);
      if (done && done.statusCode > 0) {
        res.status(done.statusCode).json(done.responseBody);
        return;
      }
      await sleep(50);
    }
    // timeout (сопственикот падна) → продолжи best-effort
  }

  captureAndStore(key, res, reserved === true);
  next();
}

/** Чисти истечени idempotency клучеви (повикано од дневен cron). */
export async function purgeIdempotencyKeys(olderThanDays = 2): Promise<number> {
  const cutoff = new Date();
  cutoff.setUTCDate(cutoff.getUTCDate() - olderThanDays);
  const r = await prisma.idempotencyKey.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return r.count;
}

function captureAndStore(key: string, res: Response, reserved: boolean): void {
  const origJson = res.json.bind(res);
  res.json = (body: unknown) => {
    const ok = res.statusCode >= 200 && res.statusCode < 300;
    if (ok) {
      // Успех → запиши го одговорот (ажурирај ја резервацијата, или создади ако немаше).
      const data = { statusCode: res.statusCode, responseBody: body as Prisma.InputJsonValue };
      void (
        reserved
          ? prisma.idempotencyKey.update({ where: { key }, data })
          : prisma.idempotencyKey.upsert({ where: { key }, create: { key, ...data }, update: data })
      ).catch(() => undefined);
    } else if (reserved) {
      // Неуспех → ослободи ја резервацијата за да е можен retry.
      void prisma.idempotencyKey.delete({ where: { key } }).catch(() => undefined);
    }
    return origJson(body);
  };
}
