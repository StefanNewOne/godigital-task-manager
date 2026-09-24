import { describe, expect, it } from 'vitest';
import {
  deriveMetrics,
  evaluateMetricThresholds,
  normalizeMetaInsights,
  type MetricThreshold,
} from './metrics.js';

describe('normalizeMetaInsights', () => {
  it('named-array формат (organic media insights)', () => {
    const raw = {
      data: [
        { name: 'reach', period: 'lifetime', values: [{ value: 1234 }] },
        { name: 'impressions', period: 'lifetime', values: [{ value: 2000 }] },
        { name: 'video_views', period: 'lifetime', values: [{ value: 800 }] },
        { name: 'total_interactions', period: 'lifetime', values: [{ value: 150 }] },
      ],
    };
    const m = normalizeMetaInsights(raw);
    expect(m.reach).toBe(1234);
    expect(m.impressions).toBe(2000);
    expect(m.views).toBe(800);
    expect(m.engagement).toBe(150);
  });

  it('named-array зема последна вредност од временски серии', () => {
    const raw = {
      data: [{ name: 'reach', period: 'day', values: [{ value: 100 }, { value: 175 }] }],
    };
    expect(normalizeMetaInsights(raw).reach).toBe(175);
  });

  it('flat object формат (ads insights) во data[0]', () => {
    const raw = {
      data: [{ reach: '5000', impressions: '9000', spend: '42.50', ctr: '1.9', frequency: '1.8' }],
    };
    const m = normalizeMetaInsights(raw);
    expect(m.reach).toBe(5000);
    expect(m.impressions).toBe(9000);
    expect(m.spend).toBe(42.5);
    expect(m.ctr).toBe(1.9);
    expect(m.frequency).toBe(1.8);
  });

  it('flat object директно на root', () => {
    expect(normalizeMetaInsights({ reach: 10, impressions: 20 }).reach).toBe(10);
  });

  it('синоними се мапираат (like_count → likes, saves → saved)', () => {
    const m = normalizeMetaInsights({
      data: [
        { name: 'like_count', values: [{ value: 12 }] },
        { name: 'saves', values: [{ value: 3 }] },
        { name: 'inline_link_clicks', values: [{ value: 40 }] },
      ],
    });
    expect(m.likes).toBe(12);
    expect(m.saved).toBe(3);
    expect(m.clicks).toBe(40);
  });

  it('cpr се зема директно од Meta (cost_per_result → cpr)', () => {
    expect(normalizeMetaInsights({ cost_per_result: '0.34' }).cpr).toBe(0.34);
    expect(normalizeMetaInsights({ cpr: 0.5 }).cpr).toBe(0.5);
  });

  it('непарсибилни/непознати влезови не рушат', () => {
    expect(normalizeMetaInsights(null)).toEqual({});
    expect(normalizeMetaInsights('nonsense')).toEqual({});
    expect(
      normalizeMetaInsights({ data: [{ name: 'reach', values: [{ value: 'NaN' }] }] }),
    ).toEqual({});
  });

  it('boolean/object/празен string вредности се испуштаат (toNum → undefined)', () => {
    expect(normalizeMetaInsights({ reach: true, impressions: '', views: {} })).toEqual({});
  });

  it('named-array: примитивна вредност директно во values[]', () => {
    expect(normalizeMetaInsights({ data: [{ name: 'reach', values: [1234] }] }).reach).toBe(1234);
  });

  it('named-array: entry со `value` наместо `values[]`', () => {
    expect(normalizeMetaInsights({ data: [{ name: 'reach', value: 500 }] }).reach).toBe(500);
  });

  it('нефинитен број (Infinity/NaN) се испушта', () => {
    expect(normalizeMetaInsights({ reach: Infinity, impressions: NaN })).toEqual({});
  });

  it('named-array прескокнува невалидни записи (null, не-object, без string name)', () => {
    const m = normalizeMetaInsights({
      data: [
        { name: 'reach', values: [{ value: 100 }] }, // валиден → тригерира named-array формат
        null, // се прескокнува
        42, // не-object → се прескокнува
        { name: 123, values: [{ value: 9 }] }, // name не е string → се прескокнува
      ],
    });
    expect(m).toEqual({ reach: 100 });
  });
});

describe('deriveMetrics', () => {
  it('frequency = impressions / reach', () => {
    expect(deriveMetrics({ impressions: 2000, reach: 1000 }).frequency).toBe(2);
  });

  it('ctr (%) = clicks / impressions * 100', () => {
    expect(deriveMetrics({ clicks: 40, impressions: 2000 }).ctr).toBe(2);
  });

  it('engagement = likes + comments + shares + saved кога недостасува', () => {
    expect(deriveMetrics({ likes: 10, comments: 5, shares: 2, saved: 3 }).engagement).toBe(20);
  });

  it('не презапишува дадени вредности', () => {
    const m = deriveMetrics({ engagement: 99, likes: 1, frequency: 5, impressions: 10, reach: 1 });
    expect(m.engagement).toBe(99);
    expect(m.frequency).toBe(5);
  });

  it('дели-со-нула се избегнува (reach=0 → нема frequency)', () => {
    expect(deriveMetrics({ impressions: 100, reach: 0 }).frequency).toBeUndefined();
  });
});

describe('evaluateMetricThresholds', () => {
  const config: MetricThreshold[] = [
    { metric: 'ctr', op: 'lt', value: 1.0, level: 'alarm', key: 'ctr.low' },
    { metric: 'frequency', op: 'gt', value: 3.0, level: 'potsetnik', key: 'frequency.high' },
    { metric: 'reach', op: 'lt', value: 500, level: 'kritichen', key: 'reach.low' },
  ];

  it('враќа аларм кога праг е прекршен', () => {
    const alerts = evaluateMetricThresholds({ ctr: 0.5, frequency: 4, reach: 1000 }, config);
    expect(alerts.map((a) => a.key).sort()).toEqual(['ctr.low', 'frequency.high']);
    expect(alerts.find((a) => a.key === 'ctr.low')?.level).toBe('alarm');
    expect(alerts.find((a) => a.key === 'ctr.low')?.actual).toBe(0.5);
  });

  it('метрика што недостасува се прескокнува (нема лажен аларм)', () => {
    expect(evaluateMetricThresholds({ frequency: 4 }, config).map((a) => a.key)).toEqual([
      'frequency.high',
    ]);
  });

  it('празна конфигурација → нема аларми', () => {
    expect(evaluateMetricThresholds({ ctr: 0.1 }, [])).toEqual([]);
  });

  it('сите оператори (lt/lte/gt/gte) работат на граница', () => {
    const c: MetricThreshold[] = [{ metric: 'ctr', op: 'lte', value: 1, level: 'alarm', key: 'k' }];
    expect(evaluateMetricThresholds({ ctr: 1 }, c)).toHaveLength(1);
    expect(evaluateMetricThresholds({ ctr: 1.01 }, c)).toHaveLength(0);
  });

  it('оператор gte работи на граница', () => {
    const c: MetricThreshold[] = [
      { metric: 'reach', op: 'gte', value: 1000, level: 'alarm', key: 'k' },
    ];
    expect(evaluateMetricThresholds({ reach: 1000 }, c)).toHaveLength(1);
    expect(evaluateMetricThresholds({ reach: 999 }, c)).toHaveLength(0);
  });
});
