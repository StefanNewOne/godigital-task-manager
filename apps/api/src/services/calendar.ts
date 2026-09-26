import { pickCalendar } from '@gd/core';
import type { CalendarConfig, ContentType } from '@gd/db';
import type { TxClient } from '../db/tenantExtension.js';

/**
 * Резолуција на применлив календар за клиент (редизајн Парче 2): посебен (clientId=client.id)
 * или СТАНДАРДЕН (clientId=null), според `client.calendarType`, со fallback (@gd/core pickCalendar).
 */
export async function resolveCalendar(
  db: TxClient,
  clientId: string,
  calendarType: string,
  contentType: ContentType,
): Promise<CalendarConfig | null> {
  const [perClient, standard] = await Promise.all([
    db.calendarConfig.findFirst({ where: { clientId, contentType } }),
    db.calendarConfig.findFirst({ where: { clientId: null, contentType } }),
  ]);
  return pickCalendar(calendarType, perClient, standard);
}
