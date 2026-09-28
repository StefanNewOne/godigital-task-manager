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

/** Пакетна комбинација на клиент: број видеа + број графики месечно. */
export interface Combination<T> {
  videos: number;
  graphics: number;
  clients: T[];
}

/**
 * Групирај клиенти по пакетна комбинација (videosPerMonth, graphicsPerMonth) — за месечно
 * одобрување групирано по комбинација (редизајн). Сортирано по видеа, потоа графики (детерминистички).
 */
export function groupByCombination<T extends { videosPerMonth: number; graphicsPerMonth: number }>(
  clients: T[],
): Array<Combination<T>> {
  const map = new Map<string, Combination<T>>();
  for (const c of clients) {
    const key = `${c.videosPerMonth}x${c.graphicsPerMonth}`;
    const existing = map.get(key);
    if (existing) existing.clients.push(c);
    else map.set(key, { videos: c.videosPerMonth, graphics: c.graphicsPerMonth, clients: [c] });
  }
  return [...map.values()].sort((a, b) => a.videos - b.videos || a.graphics - b.graphics);
}
