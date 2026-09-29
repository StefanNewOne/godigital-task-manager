/**
 * Модул 3 · Мета — чисти евалуатори на алерт-услови (META_TECH_SPEC §13).
 * Само логика над бројки; собирањето податоци и запишувањето е во API сервисот.
 */

/** A04: потрошено ≥ 90% од spend cap. */
export function spendCapReached(
  amountSpent: number | null,
  spendCap: number | null,
  ratio = 0.9,
): boolean {
  if (!spendCap || spendCap <= 0 || amountSpent == null) return false;
  return amountSpent / spendCap >= ratio;
}

/** A07: цена по резултат ↑ ≥ праг% наспроти претходните 7 дена (над мин. spend). */
export function cprSpiked(
  currentCpr: number | null,
  prevCpr: number | null,
  thresholdPct: number,
  currentSpend: number,
  minSpend: number,
): boolean {
  if (currentSpend < minSpend) return false;
  if (currentCpr == null || prevCpr == null || prevCpr <= 0) return false;
  const increasePct = ((currentCpr - prevCpr) / prevCpr) * 100;
  return increasePct >= thresholdPct;
}

/** A09: фреквенција над прагот. */
export function frequencyHigh(frequency: number | null, threshold: number): boolean {
  return frequency != null && frequency > threshold;
}

/** A10: кампањата завршува за ≤ N часа (и уште не поминала). */
export function endingSoon(stopTime: Date | null, now: Date, hours = 48): boolean {
  if (!stopTime) return false;
  const diffMs = stopTime.getTime() - now.getTime();
  return diffMs > 0 && diffMs <= hours * 3600 * 1000;
}

/** A12: токенот истекува за ≤ N дена (или веќе истекол). null expiresAt = System User без истек. */
export function tokenExpiring(expiresAt: Date | null, now: Date, days = 7): boolean {
  if (!expiresAt) return false;
  const diffMs = expiresAt.getTime() - now.getTime();
  return diffMs <= days * 24 * 3600 * 1000;
}

/** Ад не се испорачува: активен статус но effective_status укажува на проблем. */
const NON_DELIVERING = new Set([
  'DISAPPROVED',
  'WITH_ISSUES',
  'PENDING_REVIEW',
  'CAMPAIGN_PAUSED',
  'ADSET_PAUSED',
  'PENDING_BILLING_INFO',
  'AD_PAUSED',
  'NO_DELIVERY',
]);

/** A06: активна реклама што не се испорачува. */
export function adNotDelivering(status: string | null, effectiveStatus: string | null): boolean {
  if (status !== 'ACTIVE') return false;
  if (!effectiveStatus) return false;
  return effectiveStatus !== 'ACTIVE' && NON_DELIVERING.has(effectiveStatus.toUpperCase());
}
