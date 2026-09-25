/**
 * Животен циклус на клиент (редизајн). Кога Директор ќе изгаси клиент, тасковите/датумите
 * може да се активираат/закажат само **до крај на месецот на гасењето**; наредните месеци
 * се блокирани. Чиста логика (без I/O) — гејтот во API ја користи.
 */

/** Последен ден од месецот на даден датум (UTC), 23:59:59.999. */
export function endOfMonthUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

/**
 * Дали клиентот е активен за даден датум.
 * - без `deactivatedAt` → секогаш активен.
 * - со `deactivatedAt` → активен само ако датумот е до крај на месецот на гасењето.
 */
export function clientActiveForDate(deactivatedAt: Date | null | undefined, date: Date): boolean {
  if (!deactivatedAt) return true;
  return date.getTime() <= endOfMonthUtc(deactivatedAt).getTime();
}
