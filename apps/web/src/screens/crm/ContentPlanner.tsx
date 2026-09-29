import type React from 'react';
import { useMemo, useState } from 'react';
import { crmPlanKeys } from '@gd/core';
import { useSetContentPlan, type LeadRow } from '../../api/crm.js';

type Cell = 'v' | 'g' | '';
type PlanMap = Record<string, Record<number, Cell>>;

const MONTH_NAMES = [
  'Јануари',
  'Февруари',
  'Март',
  'Април',
  'Мај',
  'Јуни',
  'Јули',
  'Август',
  'Септември',
  'Октомври',
  'Ноември',
  'Декември',
];
const WEEK = ['Пон', 'Вто', 'Сре', 'Чет', 'Пет', 'Саб', 'Нед'];

function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}
function firstWeekday(year: number, month0: number): number {
  // Понеделник = 0.
  return (new Date(Date.UTC(year, month0, 1)).getUTCDay() + 6) % 7;
}

/** Content планер (чекор 10) — месечни табови, клик циклира празно→видео→графика→празно. */
export function ContentPlanner({ lead, editable }: { lead: LeadRow; editable: boolean }) {
  const save = useSetContentPlan(lead.id);
  const keys = useMemo(() => crmPlanKeys(lead.pkgStart ?? ''), [lead.pkgStart]);
  const [idx, setIdx] = useState(0);

  const initial: PlanMap = useMemo(() => {
    const m: PlanMap = {};
    for (const e of lead.planEntries ?? []) {
      (m[e.monthKey] ??= {})[e.day] = e.contentType === 'video' ? 'v' : 'g';
    }
    return m;
  }, [lead.planEntries]);
  const [plan, setPlan] = useState<PlanMap>(initial);

  const nv = lead.pkgVideos;
  const ng = lead.pkgGraphics;
  const key = keys[Math.min(idx, keys.length - 1)] ?? keys[0] ?? '';
  const [y, m0] = key.split('-').map(Number);
  const year = y ?? 2026;
  const month0 = (m0 ?? 1) - 1;

  const count = (k: string) => {
    const mm = plan[k] ?? {};
    const vals = Object.values(mm);
    return { v: vals.filter((x) => x === 'v').length, g: vals.filter((x) => x === 'g').length };
  };
  const cur = count(key);

  const persist = (next: PlanMap) => {
    const entries = Object.entries(next).flatMap(([mk, days]) =>
      Object.entries(days)
        .filter(([, t]) => t)
        .map(([d, t]) => ({
          monthKey: mk,
          day: Number(d),
          contentType: (t === 'v' ? 'video' : 'graphic') as 'video' | 'graphic',
        })),
    );
    save.mutate(entries);
  };

  const toggle = (day: number) => {
    if (!editable) return;
    const mm = { ...(plan[key] ?? {}) };
    const c = count(key);
    const curCell = mm[day] ?? '';
    let nx: Cell = curCell === '' ? 'v' : curCell === 'v' ? 'g' : '';
    if (nx === 'v' && c.v >= nv) nx = 'g';
    if (nx === 'g' && (curCell === 'g' ? true : c.g >= ng)) nx = '';
    if (nx) mm[day] = nx;
    else delete mm[day];
    const next = { ...plan, [key]: mm };
    setPlan(next);
    persist(next);
  };

  const cells: React.ReactNode[] = [];
  const offset = firstWeekday(year, month0);
  for (let i = 0; i < offset; i++) cells.push(<div key={`e${i}`} />);
  for (let d = 1; d <= daysInMonth(year, month0); d++) {
    const t = (plan[key] ?? {})[d] ?? '';
    cells.push(
      <button
        key={d}
        type="button"
        onClick={() => toggle(d)}
        style={{
          aspectRatio: '1',
          borderRadius: 6,
          border: `1px solid ${t === 'v' ? '#0866FF' : t === 'g' ? '#DB2777' : 'var(--gd-border)'}`,
          background: t === 'v' ? '#EBF2FF' : t === 'g' ? '#FCE7F3' : '#fff',
          color: t === 'v' ? '#0052D9' : t === 'g' ? '#BE185D' : 'var(--gd-ink)',
          fontSize: 11,
          cursor: editable ? 'pointer' : 'default',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 2,
        }}
      >
        <span style={{ fontWeight: 600 }}>{d}</span>
        {t && <span style={{ fontSize: 9 }}>{t === 'v' ? 'Видео' : 'Графика'}</span>}
      </button>,
    );
  }

  return (
    <div style={{ marginTop: 16 }}>
      <div style={sectionTitle}>
        Content планер · {crmPlanKeys(lead.pkgStart ?? '').length} месеци
      </div>
      <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)', marginBottom: 8 }}>
        {editable
          ? 'Клик на ден: празно → видео → графика → празно. Лимитот е бројот од договорот.'
          : 'Планерот е заклучен по чекорот „Стратегија".'}
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {keys.map((k, i) => {
          const c = count(k);
          const ok = c.v === nv && c.g === ng;
          const [ky, km] = k.split('-').map(Number);
          return (
            <button
              key={k}
              type="button"
              onClick={() => setIdx(i)}
              style={{
                padding: '5px 10px',
                borderRadius: 6,
                border: 'none',
                background: i === idx ? '#fff' : 'transparent',
                boxShadow: i === idx ? '0 1px 2px rgba(0,0,0,.08)' : 'none',
                fontWeight: i === idx ? 600 : 500,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              {MONTH_NAMES[(km ?? 1) - 1]?.slice(0, 3)} {ky}
              {ok ? ' ✓' : ''}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
        {WEEK.map((w) => (
          <div key={w} style={{ fontSize: 10, textAlign: 'center', color: 'var(--gd-ink-muted)' }}>
            {w}
          </div>
        ))}
        {cells}
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12 }}>
        <span style={{ color: cur.v === nv ? '#15803D' : '#B45309' }}>
          Видеа {cur.v}/{nv}
        </span>
        <span style={{ color: cur.g === ng ? '#15803D' : '#B45309' }}>
          Графики {cur.g}/{ng}
        </span>
      </div>
    </div>
  );
}

const sectionTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--gd-ink-muted)',
  marginBottom: 8,
};
