import type React from 'react';
import { useSearchParams } from 'react-router-dom';
import { MONTH_LABELS } from '../lib/calendar.js';

/**
 * 240px контекст-панел „Периоди" за Преглед/Клиенти (Handoff §7/§8).
 * Заглавието стои во топ-стрипот (AppShell); собирањето се води преку ?sb=0.
 */
export function PeriodSidebar() {
  const [searchParams] = useSearchParams();
  if (searchParams.get('sb') === '0') return null;

  const now = new Date();
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const periods = [0, -1, 1].map((delta) => {
    const d = new Date(Date.UTC(y, m + delta, 1));
    return {
      key: `${d.getUTCFullYear()}-${d.getUTCMonth()}`,
      label: `${MONTH_LABELS[d.getUTCMonth()]} ${d.getUTCFullYear()}`,
      active: delta === 0,
    };
  });

  return (
    <aside style={sidebar}>
      <div style={groupLabel}>Периоди</div>
      {periods.map((p) => (
        <div key={p.key} style={p.active ? activeRow : row}>
          {p.label}
        </div>
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
  padding: '8px 10px',
  borderRadius: 6,
  fontSize: 14,
  color: 'var(--gd-ink)',
  cursor: 'default',
};
const activeRow: React.CSSProperties = {
  ...row,
  background: 'var(--gd-primary-tint)',
  color: 'var(--gd-primary-hover)',
  fontWeight: 600,
};
