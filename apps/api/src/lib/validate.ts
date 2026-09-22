import type { z } from 'zod';
import { AppError } from './errors.js';

/** Валидирај влез со Zod; фрли AppError со детали на македонски (CLAUDE.md §16). */
export function parse<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new AppError(
      'VALIDATION_FAILED',
      'Проверете ги внесените полиња.',
      400,
      result.error.flatten(),
    );
  }
  return result.data;
}
