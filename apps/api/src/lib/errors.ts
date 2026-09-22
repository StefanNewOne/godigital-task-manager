import type { NextFunction, Request, Response } from 'express';
import type { ErrorCode } from '@gd/core';

/**
 * Апликациска грешка. `message` е на македонски, спремна за toast (CLAUDE.md §16).
 * API одговара во облик { code, message, details? }.
 */
export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    message: string,
    public httpStatus = 400,
    public details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    res.status(err.httpStatus).json({ code: err.code, message: err.message, details: err.details });
    return;
  }
  // Генеричка client-facing грешка — stack trace никогаш до клиент (CLAUDE.md §9.5).
  console.error(err);
  res.status(500).json({ code: 'VALIDATION_FAILED', message: 'Настана неочекувана грешка.' });
}
