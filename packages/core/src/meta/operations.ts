/**
 * Модул 3 · Мета — каталог на операции O1–O12 (META_TECH_SPEC §12).
 * Ова се ПЛАНОВИ за промена, не извршување — човек ги прави рачно во Ads Manager (D1).
 */

export const OP_CODES = [
  'O1',
  'O2',
  'O3',
  'O4',
  'O5',
  'O6',
  'O7',
  'O8',
  'O9',
  'O10',
  'O11',
  'O12',
] as const;

export type OpCode = (typeof OP_CODES)[number];

/** На кое ниво дејствува операцијата. */
export type OpLevel = 'campaign' | 'adset' | 'ad' | 'account' | 'any';

export interface OpMeta {
  code: OpCode;
  level: OpLevel;
  /** Македонска етикета (UI). */
  label: string;
  /** Дали типично носи предупредување (learning/буџет/…). */
  mayWarn: boolean;
}

export const OP_CATALOG: Record<OpCode, OpMeta> = {
  O1: { code: 'O1', level: 'any', label: 'Пауза / активирај', mayWarn: true },
  O2: { code: 'O2', level: 'campaign', label: 'Дневен буџет', mayWarn: true },
  O3: { code: 'O3', level: 'campaign', label: 'Закажан буџет', mayWarn: false },
  O4: { code: 'O4', level: 'adset', label: 'Реклама од пост', mayWarn: true },
  O5: { code: 'O5', level: 'adset', label: 'Ново видео', mayWarn: false },
  O6: { code: 'O6', level: 'adset', label: 'Копирај ad set', mayWarn: true },
  O7: { code: 'O7', level: 'campaign', label: 'Нов ad set', mayWarn: true },
  O8: { code: 'O8', level: 'account', label: 'Нова кампања', mayWarn: false },
  O9: { code: 'O9', level: 'campaign', label: 'Распоред (краен датум)', mayWarn: false },
  O10: { code: 'O10', level: 'ad', label: 'CTA / линк / шаблон', mayWarn: false },
  O11: { code: 'O11', level: 'any', label: 'Преименување', mayWarn: true },
  O12: { code: 'O12', level: 'campaign', label: 'Дуплирај кампања', mayWarn: false },
};

export function opMeta(code: OpCode): OpMeta {
  return OP_CATALOG[code];
}
