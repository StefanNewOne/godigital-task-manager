import type React from 'react';
import { TASK_STATUS_META, type TaskStatus } from '@gd/core';
import { useOverview } from '../api/overview.js';

const LEVEL_COLOR: Record<string, string> = {
  ok: 'var(--gd-success)',
  warn: 'var(--gd-warning)',
  danger: 'var(--gd-danger)',
};

/** Директорски преглед (Handoff §7): покриеност по клиент + работа по статус. */
export function Overview() {
  const { data, isLoading } = useOverview();

  if (isLoading) return <div style={{ padding: 24, color: 'var(--gd-ink-muted)' }}>Вчитување…</div>;
  if (!data) return null;

  return (
    <div
      style={{
        padding: '24px 20px',
        display: 'grid',
        gap: 24,
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
      }}
    >
      <section style={card}>
        <h2 style={cardTitle}>Покриеност по клиент</h2>
        {data.coverage.map((c) => (
          <div key={c.clientId} style={covRow}>
            <span
              style={{
                width: 4,
                alignSelf: 'stretch',
                borderRadius: 2,
                background: LEVEL_COLOR[c.level],
              }}
            />
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
            <span style={{ flex: 1, fontWeight: 500 }}>{c.name}</span>
            <span
              style={{
                color: LEVEL_COLOR[c.level],
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {c.days} дена
            </span>
          </div>
        ))}
        {data.coverage.length === 0 && <p style={muted}>Нема активни клиенти.</p>}
      </section>

      <section style={card}>
        <h2 style={cardTitle}>Работа по статус</h2>
        {data.byStatus
          .filter((s) => (TASK_STATUS_META[s.status as TaskStatus] ? true : false))
          .map((s) => (
            <div key={s.status} style={statusRow}>
              <span style={{ flex: 1 }}>
                {TASK_STATUS_META[s.status as TaskStatus]?.label ?? s.status}
              </span>
              <span style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{s.count}</span>
            </div>
          ))}
        {data.byStatus.length === 0 && <p style={muted}>Нема таскови.</p>}
      </section>
    </div>
  );
}

const card: React.CSSProperties = {
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  padding: 16,
};
const cardTitle: React.CSSProperties = { fontSize: 16, fontWeight: 600, margin: '0 0 12px' };
const covRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 0',
  borderBottom: '1px solid var(--gd-border)',
  fontSize: 14,
};
const statusRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '6px 0',
  borderBottom: '1px solid var(--gd-border)',
  fontSize: 14,
};
const muted: React.CSSProperties = { color: 'var(--gd-ink-muted)', fontSize: 14 };
