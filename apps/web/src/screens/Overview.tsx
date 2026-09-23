import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { TASK_STATUS_META, coverageLevel, type TaskStatus } from '@gd/core';
import { tokens } from '@gd/ui';
import { useOverview, type CoverageRow } from '../api/overview.js';
import { StatusBadge } from '../components/StatusBadge.js';

/** ISO → DD.MM (кратко, за „до {датум}"). */
function shortDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Една линија на покриеност по тип: лента (дена/30) + „до {датум}". */
function CoverageLine({
  label,
  days,
  quota,
  until,
}: {
  label: string;
  days: number;
  quota: number;
  until: string | null;
}) {
  const level = coverageLevel(days);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
      <span style={{ width: 92, color: 'var(--gd-ink-muted)' }}>
        {label} · {quota}/мес
      </span>
      <div
        style={{
          flex: '0 0 72px',
          height: 4,
          borderRadius: 9999,
          background: 'var(--gd-surface-alt)',
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${Math.min(days / 30, 1) * 100}%`,
            background: LEVEL_COLOR[level],
          }}
        />
      </div>
      <span style={{ color: LEVEL_TEXT[level], fontWeight: 600, ...tabular }}>{days} дена</span>
      {until && <span style={{ color: 'var(--gd-ink-muted)' }}>· до {shortDate(until)}</span>}
    </div>
  );
}

const LEVEL_COLOR: Record<CoverageRow['level'], string> = {
  ok: 'var(--gd-success)',
  warn: 'var(--gd-warning)',
  danger: 'var(--gd-danger)',
};
const LEVEL_TEXT: Record<CoverageRow['level'], string> = {
  ok: 'var(--gd-success-text)',
  warn: 'var(--gd-warning-text)',
  danger: 'var(--gd-danger-text)',
};

/** Директорски преглед (Handoff §2.7): покриеност по клиент + работа по статус. */
export function Overview() {
  const { data, isLoading } = useOverview();
  const navigate = useNavigate();

  if (isLoading) return <div style={{ padding: 24, color: 'var(--gd-ink-muted)' }}>Вчитување…</div>;
  if (!data) return null;

  const coverage = [...data.coverage].sort((a, b) => a.days - b.days); // најлошо прво
  const maxCount = Math.max(1, ...data.byStatus.map((s) => s.count));

  return (
    <div style={wrap}>
      {/* Покриеност по клиент — клик отвора клиент во Список */}
      <section style={card}>
        <h2 style={cardTitle}>Покриеност по клиент</h2>
        {coverage.map((c) => (
          <button
            key={c.clientId}
            style={covRow}
            onClick={() => navigate(`/tasks?client=${c.clientId}&tab=list`)}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gd-surface-alt)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ ...covBar, background: LEVEL_COLOR[c.level] }} />
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
            <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
              <div style={{ fontWeight: 500, marginBottom: 4 }}>{c.name}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {c.video != null && (
                  <CoverageLine
                    label="Видео"
                    days={c.video}
                    quota={c.videoQuota}
                    until={c.videoUntil}
                  />
                )}
                {c.graphic != null && (
                  <CoverageLine
                    label="Графика"
                    days={c.graphic}
                    quota={c.graphicQuota}
                    until={c.graphicUntil}
                  />
                )}
              </div>
            </div>
            <span style={{ color: LEVEL_TEXT[c.level], fontWeight: 600, ...tabular }}>
              {c.days} дена
            </span>
          </button>
        ))}
        {coverage.length === 0 && <p style={muted}>Нема активни клиенти.</p>}
      </section>

      {/* Работа по статус — клик отвора Табла филтрирана по статус */}
      <section style={card}>
        <h2 style={cardTitle}>Работа по статус</h2>
        {data.byStatus
          .filter((s) => TASK_STATUS_META[s.status as TaskStatus])
          .map((s) => (
            <button
              key={s.status}
              style={statusRow}
              onClick={() => navigate(`/tasks?status=${s.status}&tab=board`)}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--gd-surface-alt)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <div style={{ width: 150, flex: '0 0 150px', textAlign: 'left' }}>
                <StatusBadge status={s.status} />
              </div>
              <div style={barTrack}>
                <div
                  style={{
                    ...barFill,
                    width: `${(s.count / maxCount) * 100}%`,
                    background:
                      tokens.statusColor[s.status as keyof typeof tokens.statusColor] ??
                      'var(--gd-ink-muted)',
                  }}
                />
              </div>
              <span style={{ width: 32, textAlign: 'right', fontWeight: 600, ...tabular }}>
                {s.count}
              </span>
              <span
                style={{
                  width: 84,
                  textAlign: 'right',
                  fontSize: 12,
                  color: 'var(--gd-ink-muted)',
                  ...tabular,
                }}
              >
                {s.avgDays > 0 ? `◷ ${s.avgDays}д просек` : ''}
              </span>
            </button>
          ))}
        {data.byStatus.length === 0 && <p style={muted}>Нема таскови.</p>}
      </section>

      {/* Аларми (B1) и Кампањи (B2) картички доаѓаат со тие модул-фази (§8.5). */}
    </div>
  );
}

const tabular: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };
const wrap: React.CSSProperties = {
  padding: '24px 20px',
  display: 'grid',
  gap: 24,
  gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
};
const card: React.CSSProperties = {
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  padding: 16,
};
const cardTitle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: '24px',
  fontWeight: 600,
  margin: '0 0 12px',
};
const covRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '8px 4px',
  border: 'none',
  borderBottom: '1px solid var(--gd-border)',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 14,
};
const covBar: React.CSSProperties = {
  width: 4,
  alignSelf: 'stretch',
  borderRadius: 2,
  minHeight: 32,
};
const statusRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  width: '100%',
  padding: '6px 4px',
  border: 'none',
  borderBottom: '1px solid var(--gd-border)',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 14,
};
const barTrack: React.CSSProperties = {
  flex: 1,
  height: 6,
  borderRadius: 9999,
  background: 'var(--gd-surface-alt)',
  overflow: 'hidden',
};
const barFill: React.CSSProperties = {
  height: '100%',
  background: 'var(--gd-primary)',
  borderRadius: 9999,
};
const muted: React.CSSProperties = { color: 'var(--gd-ink-muted)', fontSize: 14 };
