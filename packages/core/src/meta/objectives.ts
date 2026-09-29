/**
 * Модул 3 · Мета — мапа на метрики по Objective (META_TECH_SPEC §10, PRD §12).
 * ЗАДОЛЖИТЕЛНА: секој Objective има свој резултат и цена по резултат. Пресекот низ клиенти
 * НИКОГАШ не собира резултати со различен Objective (`canAggregate`).
 */

/** Objective клучеви (META_TECH_SPEC §4.2 `objectiveKey`). */
export const OBJECTIVE_KEYS = [
  'msg',
  'thru',
  'reach',
  'traffic',
  'lead',
  'leadWeb',
  'cart',
  'buy',
] as const;

export type ObjectiveKey = (typeof OBJECTIVE_KEYS)[number];

export interface ObjectiveMeta {
  /** Македонска етикета на Objective. */
  objective: string;
  /** Што е „резултат" за овој Objective. */
  resultLabel: string;
  /** Етикета за цена по резултат. */
  costLabel: string;
  /** Дали ROAS има смисла (само продажби). */
  hasRoas: boolean;
}

export const OBJECTIVE_MAP: Record<ObjectiveKey, ObjectiveMeta> = {
  msg: {
    objective: 'Пораки (Engagement)',
    resultLabel: 'Започнати разговори',
    costLabel: 'Цена по разговор',
    hasRoas: false,
  },
  thru: {
    objective: 'ThruPlay (Engagement)',
    resultLabel: 'ThruPlays',
    costLabel: 'Цена по ThruPlay',
    hasRoas: false,
  },
  reach: {
    objective: 'Досег (Awareness)',
    resultLabel: 'Досег',
    costLabel: 'CPM',
    hasRoas: false,
  },
  traffic: {
    objective: 'Сообраќај · веб-страна',
    resultLabel: 'Прегледи на страна',
    costLabel: 'Цена по преглед',
    hasRoas: false,
  },
  lead: {
    objective: 'Лидови · инстант форма',
    resultLabel: 'Лидови',
    costLabel: 'Цена по лид',
    hasRoas: false,
  },
  leadWeb: {
    objective: 'Лидови · веб-страна',
    resultLabel: 'Лидови',
    costLabel: 'Цена по лид',
    hasRoas: false,
  },
  cart: {
    objective: 'Продажби · во кошничка',
    resultLabel: 'Додавања во кошничка',
    costLabel: 'Цена по додавање',
    hasRoas: false,
  },
  buy: {
    objective: 'Продажби · купување',
    resultLabel: 'Купувања',
    costLabel: 'Цена по купување',
    hasRoas: true,
  },
};

export function objectiveMeta(key: ObjectiveKey): ObjectiveMeta {
  return OBJECTIVE_MAP[key];
}

/** ROAS има смисла само за продажби (никогаш кај пораки). */
export function objectiveHasRoas(key: ObjectiveKey): boolean {
  return OBJECTIVE_MAP[key].hasRoas;
}

/**
 * Дали множество Objective клучеви смеат да се СОБИРААТ во еден збир.
 * Правило (§10): само ако сите се ист Objective. Празно множество не е за собирање.
 */
export function canAggregate(keys: readonly ObjectiveKey[]): boolean {
  if (keys.length === 0) return false;
  const first = keys[0];
  return keys.every((k) => k === first);
}

/** Цена по резултат (spend / results); null ако нема резултати. */
export function costPerResult(spend: number, results: number): number | null {
  if (results <= 0) return null;
  return spend / results;
}

/** ROAS (вредност/потрошено); null ако нема потрошено или Objective не е продажби. */
export function roas(key: ObjectiveKey, value: number, spend: number): number | null {
  if (!OBJECTIVE_MAP[key].hasRoas || spend <= 0) return null;
  return value / spend;
}

/** Групирај објекти по Objective (за Пресек — секоја група е збирлива посебно). */
export function groupByObjective<T>(
  items: readonly T[],
  keyOf: (item: T) => ObjectiveKey,
): Map<ObjectiveKey, T[]> {
  const out = new Map<ObjectiveKey, T[]>();
  for (const item of items) {
    const k = keyOf(item);
    const arr = out.get(k) ?? [];
    arr.push(item);
    out.set(k, arr);
  }
  return out;
}
