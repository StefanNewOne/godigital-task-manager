import type React from 'react';
import { useSearchParams } from 'react-router-dom';
import { MONTH_LABELS } from '../lib/calendar.js';

/**
 * 240px контекст-панел „Периоди" за Преглед/Клиенти (Handoff §7/§8).
 * Изборот се води преку ?period=YYYY-MM (default: тековниот месец). Кликлив.
 */
export function PeriodSidebar() {
  const [searchParams, setSearchParams] = useSearchParams();
  if (searchParams.get('sb') === '0') return null;

  const now = new Date();
  const currentKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const selected = searchParams.get('period') ?? currentKey;

  const periods = [0, -1, 1].map((delta) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + delta, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    return { key, label: `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}` };
  });

  const pick = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('period', key);
    setSearchParams(next);
  };

  return (
    <aside style={sidebar}>
      <div style={groupLabel}>Периоди</div>
      {periods.map((p) => (
        <button
          key={p.key}
          style={p.key === selected ? activeRow : row}
          onClick={() => pick(p.key)}
        >
          {p.label}
        </button>
      ))}
    </aside>
  );
}

const sidebar: React.CSSProperties = {
  width: 240,
  flex: '0 0 240px',
  borderRight: '1px solid var(--gd-border)',
  background: 'var(--gd-surface)',
  padding: 16,
  overflow: 'auto',
};
const groupLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--gd-ink-muted)',
  marginBottom: 8,
};
const row: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '8px 10px',
  borderRadius: 6,
  fontSize: 14,
  border: 'none',
  background: 'transparent',
  color: 'var(--gd-ink)',
  cursor: 'pointer',
};
const activeRow: React.CSSProperties = {
  ...row,
  background: 'var(--gd-primary-tint)',
  color: 'var(--gd-primary-hover)',
  fontWeight: 600,
};
