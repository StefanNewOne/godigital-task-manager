import { pino } from 'pino';
import { env } from '../env.js';

/** Споделен структуриран логер (Pino, §16). Тивок во тестови. */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : 'info',
});
