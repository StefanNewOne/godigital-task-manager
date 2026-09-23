import type { NextFunction, Request, Response } from 'express';
import { PERMISSIONS, type Role, type Screen } from '@gd/core';
import { requestContext } from '../db/context.js';
import { AppError } from '../lib/errors.js';
import { verifyAccessToken } from '../lib/auth.js';

function extractToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (header?.startsWith('Bearer ')) return header.slice(7);
  const cookieToken = (req.cookies as Record<string, string> | undefined)?.access_token;
  return cookieToken ?? null;
}

/**
 * Проверува JWT и го поставува per-request контекстот (tenantId/actor) за tenant extension +
 * recordEvent. Целата низа надолу тече внатре во ALS `run`, за контекстот да важи и во async.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = extractToken(req);
  if (!token) {
    next(new AppError('UNAUTHENTICATED', 'Не сте најавени.', 401));
    return;
  }
  let payload;
  try {
    payload = verifyAccessToken(token);
  } catch {
    next(new AppError('UNAUTHENTICATED', 'Сесијата е истечена или неважечка.', 401));
    return;
  }
  req.auth = payload;
  requestContext.run(
    { tenantId: payload.tenantId, actorId: payload.sub, actorRole: payload.role },
    () => next(),
  );
}

/** Дозволува само наведените улоги (серверот одлучува; UI само крие) — CLAUDE.md И4. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new AppError('UNAUTHENTICATED', 'Не сте најавени.', 401));
      return;
    }
    if (!roles.includes(req.auth.role)) {
      next(new AppError('FORBIDDEN_ROLE', 'Немате дозвола за оваа операција.', 403));
      return;
    }
    next();
  };
}

/**
 * Дозволува само улоги што го носат екранот во `nav` (иста табела `PERMISSIONS` како UI Guard-от) —
 * defense in depth (CLAUDE.md §9.1): серверот не се потпира на скривање на иконата во UI.
 */
export function requireScreen(screen: Screen) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.auth) {
      next(new AppError('UNAUTHENTICATED', 'Не сте најавени.', 401));
      return;
    }
    if (!PERMISSIONS[req.auth.role].nav.includes(screen)) {
      next(new AppError('FORBIDDEN_ROLE', 'Немате дозвола за овој екран.', 403));
      return;
    }
    next();
  };
}
