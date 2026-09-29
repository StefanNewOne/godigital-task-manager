/**
 * Модул 3 · Мета — каталог на алерти (META_TECH_SPEC §13).
 * Алертите живеат САМО во Мета (D5) — не одат во постоечкиот `Notification`/„Аларми" панел.
 */

export const ALERT_CODES = [
  'A01',
  'A02',
  'A03',
  'A04',
  'A05',
  'A06',
  'A07',
  'A08',
  'A09',
  'A10',
  'A11',
  'A12',
  'A13',
] as const;

export type AlertCode = (typeof ALERT_CODES)[number];

export type AlertSeverity = 'crit' | 'high' | 'mid' | 'info';

export const ALERT_SEVERITY_ORDER: Record<AlertSeverity, number> = {
  crit: 0,
  high: 1,
  mid: 2,
  info: 3,
};

export interface AlertMeta {
  code: AlertCode;
  severity: AlertSeverity;
  /** Македонски наслов (UI). */
  title: string;
  /** Кратко објаснување на условот. */
  condition: string;
  /** Sync job што го евалуира. */
  job: string;
}

export const ALERT_CATALOG: Record<AlertCode, AlertMeta> = {
  A01: {
    code: 'A01',
    severity: 'crit',
    title: 'Одбиена реклама',
    condition: 'Рекламата е одбиена при преглед (reviewStatus=rejected).',
    job: 'meta.status',
  },
  A02: {
    code: 'A02',
    severity: 'crit',
    title: 'Оневозможен рекламен акаунт',
    condition: 'Статусот на акаунтот е оневозможен или ограничен.',
    job: 'meta.account',
  },
  A03: {
    code: 'A03',
    severity: 'crit',
    title: 'Неуспешно плаќање',
    condition: 'Плаќањето на акаунтот не успеа.',
    job: 'meta.account',
  },
  A04: {
    code: 'A04',
    severity: 'crit',
    title: 'Буџетот при крај',
    condition: 'Потрошено ≥ 90% од spend cap.',
    job: 'meta.account',
  },
  A05: {
    code: 'A05',
    severity: 'high',
    title: 'Активна кампања без трошок',
    condition: 'Активна кампања со spend=0 за 24 часа.',
    job: 'meta.insights.today',
  },
  A06: {
    code: 'A06',
    severity: 'high',
    title: 'Реклама без испорака',
    condition: 'Активна реклама што не се испорачува (effective_status/issues).',
    job: 'meta.status',
  },
  A07: {
    code: 'A07',
    severity: 'mid',
    title: 'Цената по резултат скокна',
    condition: 'CPR ↑ над прагот наспроти претходните 7 дена (над мин. spend).',
    job: 'meta.insights.today',
  },
  A08: {
    code: 'A08',
    severity: 'mid',
    title: 'Заглавена во учење',
    condition: 'learningStage=LIMITED повеќе од 5 дена.',
    job: 'meta.structure',
  },
  A09: {
    code: 'A09',
    severity: 'mid',
    title: 'Висока фреквенција',
    condition: 'Фреквенција за 7 дена над прагот.',
    job: 'meta.insights.today',
  },
  A10: {
    code: 'A10',
    severity: 'info',
    title: 'Кампањата завршува',
    condition: 'stopTime за ≤ 48 часа.',
    job: 'meta.structure',
  },
  A11: {
    code: 'A11',
    severity: 'high',
    title: 'Асет недостапен',
    condition: 'Асетот недостапен (2 неуспеха) или IG пораки исклучени.',
    job: 'meta.status',
  },
  A12: {
    code: 'A12',
    severity: 'crit',
    title: 'Токенот истекува',
    condition: 'Токенот истекува за ≤ 7 дена или е повлечен.',
    job: 'meta.token',
  },
  A13: {
    code: 'A13',
    severity: 'info',
    title: 'Legacy кампања',
    condition: 'Legacy Advantage+ Shopping кампања.',
    job: 'meta.structure',
  },
};

export function alertMeta(code: AlertCode): AlertMeta {
  return ALERT_CATALOG[code];
}

/** dedupeKey за групирање (код + Meta ID на објектот) — §4.6. */
export function alertDedupeKey(code: AlertCode, objectMetaId: string | null): string {
  return `${code}:${objectMetaId ?? 'account'}`;
}

/** Сортирање по сериозност (crit прв). */
export function compareAlertSeverity(a: AlertSeverity, b: AlertSeverity): number {
  return ALERT_SEVERITY_ORDER[a] - ALERT_SEVERITY_ORDER[b];
}
