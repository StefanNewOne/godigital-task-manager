/**
 * Meta метрики — чиста доменска логика (B2, PRD §4.7, §11 B2). БЕЗ I/O.
 *
 * Три детерминистички чекори што worker-от (metrics.pull) ги повикува откако ќе ги
 * извлече суровите податоци од Graph API:
 *   1. normalizeMetaInsights(raw) → канонски полиња (двата Graph формати).
 *   2. deriveMetrics(m)           → пресметливи метрики што Meta не ги враќа секогаш.
 *   3. evaluateMetricThresholds(m, config) → аларми (config-driven; прагови НЕ се
 *      хардкодирани — O-B2b се решава во Админ → Автоматизации, како StatusDeadlineConfig).
 *
 * Core работи со `number`; конверзија во Prisma `Decimal` се прави на работ (API/worker).
 */

/** Канонски метрики како во `MetricSnapshot` (сите опциони — недостиг = `undefined` → `null` во DB). */
export interface NormalizedMetrics {
  reach?: number;
  impressions?: number;
  views?: number;
  engagement?: number;
  spend?: number;
  cpr?: number;
  ctr?: number;
  frequency?: number;
  /** Помошни суровини што ги користи deriveMetrics (не се колони). */
  clicks?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  saved?: number;
}

/** Синоними: Graph име на метрика → канонско поле. Опфаќа organic media + ads insights. */
const METRIC_SYNONYMS: Record<string, keyof NormalizedMetrics> = {
  reach: 'reach',
  impressions: 'impressions',
  video_views: 'views',
  plays: 'views',
  ig_reels_video_view_total_time: 'views',
  video_view: 'views',
  views: 'views',
  engagement: 'engagement',
  total_interactions: 'engagement',
  post_engagement: 'engagement',
  spend: 'spend',
  ctr: 'ctr',
  frequency: 'frequency',
  cpr: 'cpr',
  cost_per_result: 'cpr',
  cost_per_purchase: 'cpr',
  clicks: 'clicks',
  inline_link_clicks: 'clicks',
  likes: 'likes',
  like_count: 'likes',
  reactions: 'likes',
  comments: 'comments',
  comments_count: 'comments',
  shares: 'shares',
  saved: 'saved',
  saves: 'saved',
};

/** Претвори unknown во конечен број, или undefined ако не е парсибилен. */
function toNum(v: unknown): number | undefined {
  if (typeof v === 'number') return Number.isFinite(v) ? v : undefined;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Сведи суров Graph одговор во рамен `{metricName: number}`.
 * Поддржува два формати:
 *   - named-array (organic media insights): `{ data: [{ name, values: [{ value }] }] }`
 *   - flat object (ads insights):           `{ reach, impressions, spend, ... }` (со или без `data:[{…}]`)
 */
function flattenGraph(raw: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  if (raw === null || typeof raw !== 'object') return out;

  const root = raw as Record<string, unknown>;
  const data = root.data;

  // named-array формат
  if (
    Array.isArray(data) &&
    data.length > 0 &&
    data[0] !== null &&
    typeof data[0] === 'object' &&
    'name' in (data[0] as object)
  ) {
    for (const entry of data) {
      if (entry === null || typeof entry !== 'object') continue;
      const e = entry as Record<string, unknown>;
      const name = typeof e.name === 'string' ? e.name : undefined;
      if (!name) continue;
      let value: number | undefined;
      if (Array.isArray(e.values) && e.values.length > 0) {
        const last = e.values[e.values.length - 1];
        value = toNum(
          last !== null && typeof last === 'object'
            ? (last as Record<string, unknown>).value
            : last,
        );
      } else {
        value = toNum(e.value);
      }
      if (value !== undefined) out[name] = value;
    }
    return out;
  }

  // flat object формат — или директно на root, или во data[0]
  const flat =
    Array.isArray(data) && data.length > 0 && data[0] !== null && typeof data[0] === 'object'
      ? (data[0] as Record<string, unknown>)
      : root;
  for (const [k, v] of Object.entries(flat)) {
    const n = toNum(v);
    if (n !== undefined) out[k] = n;
  }
  return out;
}

/** Нормализирај суров Graph одговор во канонски метрики (чекор 1). */
export function normalizeMetaInsights(raw: unknown): NormalizedMetrics {
  const flat = flattenGraph(raw);
  const m: NormalizedMetrics = {};
  for (const [name, value] of Object.entries(flat)) {
    const field = METRIC_SYNONYMS[name];
    if (field && m[field] === undefined) m[field] = value;
  }
  return m;
}

/**
 * Пополни ги пресметливите метрики што недостасуваат (чекор 2). Не презапишува дадени вредности.
 *   frequency = impressions / reach
 *   ctr (%)   = clicks / impressions * 100
 *   engagement = likes + comments + shares + saved   (ако не е дадено директно)
 * `cpr`/`cpm` бараат дефиниран „резултат"; не ги измислуваме — се земаат само директно од Meta.
 */
export function deriveMetrics(input: NormalizedMetrics): NormalizedMetrics {
  const m: NormalizedMetrics = { ...input };

  if (m.engagement === undefined) {
    const parts = [m.likes, m.comments, m.shares, m.saved].filter(
      (v): v is number => v !== undefined,
    );
    if (parts.length > 0) m.engagement = parts.reduce((a, b) => a + b, 0);
  }

  if (
    m.frequency === undefined &&
    m.impressions !== undefined &&
    m.reach !== undefined &&
    m.reach > 0
  ) {
    m.frequency = round(m.impressions / m.reach, 4);
  }

  if (
    m.ctr === undefined &&
    m.clicks !== undefined &&
    m.impressions !== undefined &&
    m.impressions > 0
  ) {
    m.ctr = round((m.clicks / m.impressions) * 100, 4);
  }

  return m;
}

function round(n: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

// --- Прагови и аларми (config-driven; O-B2b) ------------------------------------

/** Оператор за споредба на метрика со праг. */
export type ThresholdOp = 'lt' | 'lte' | 'gt' | 'gte';

/** Едно правило за праг: „ако {metric} {op} {value} → аларм на {level}". */
export interface MetricThreshold {
  metric: keyof NormalizedMetrics;
  op: ThresholdOp;
  value: number;
  level: 'potsetnik' | 'alarm' | 'kritichen';
  /** Стабилен клуч за dedupe и наратив (пр. 'ctr.low'). */
  key: string;
}

export interface MetricAlert {
  key: string;
  metric: keyof NormalizedMetrics;
  op: ThresholdOp;
  threshold: number;
  actual: number;
  level: 'potsetnik' | 'alarm' | 'kritichen';
}

function compare(actual: number, op: ThresholdOp, threshold: number): boolean {
  switch (op) {
    case 'lt':
      return actual < threshold;
    case 'lte':
      return actual <= threshold;
    case 'gt':
      return actual > threshold;
    case 'gte':
      return actual >= threshold;
  }
}

/**
 * Евалуирај ги праговите против метриките (чекор 3). Праговите доаѓаат од конфигурација
 * (Админ → Автоматизации), НЕ се хардкодирани — конечните вредности се одлука O-B2b.
 * Метрика што недостасува се прескокнува (нема лажен аларм).
 */
export function evaluateMetricThresholds(
  metrics: NormalizedMetrics,
  thresholds: MetricThreshold[],
): MetricAlert[] {
  const alerts: MetricAlert[] = [];
  for (const t of thresholds) {
    const actual = metrics[t.metric];
    if (actual === undefined) continue;
    if (compare(actual, t.op, t.value)) {
      alerts.push({
        key: t.key,
        metric: t.metric,
        op: t.op,
        threshold: t.value,
        actual,
        level: t.level,
      });
    }
  }
  return alerts;
}
