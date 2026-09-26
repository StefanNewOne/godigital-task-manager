/**
 * Резолуција на календар (редизајн, Парче 2). Клиентот има `calendarType`:
 * - `standarden` → користи го СТАНДАРДНИОТ календар (tenant-ниво, `clientId = null`).
 * - `specificen` → користи го ПОСЕБНИОТ календар на клиентот (override).
 * Во двата случаи има fallback на другиот ако избраниот недостасува, за да не остане клиент
 * без распоред.
 */
export type CalendarType = 'standarden' | 'specificen';

/**
 * Избери го применливиот календар за клиент.
 * @param calendarType `client.calendarType`
 * @param perClient календар со `clientId = client.id` (или null/undefined ако нема)
 * @param standard стандардниот календар (`clientId = null`) за истиот `contentType`
 */
export function pickCalendar<T>(
  calendarType: CalendarType | string,
  perClient: T | null | undefined,
  standard: T | null | undefined,
): T | null {
  if (calendarType === 'specificen') return perClient ?? standard ?? null;
  return standard ?? perClient ?? null;
}
