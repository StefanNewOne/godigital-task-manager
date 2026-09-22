import type React from 'react';
import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { ClientRow, TaskListItem } from '../../lib/types.js';
import {
  bucketOf,
  deadlineFor,
  fmtDate,
  relDate,
  type UrgencyBucket,
} from '../../lib/tasksView.js';
import { StatusBadge } from '../../components/StatusBadge.js';

type View = 'all' | 'late' | 'week';

const SECTIONS: Array<{ key: UrgencyBucket; label: string; color: string }> = [
  { key: 'overdue', label: 'Доцни', color: '#DC2626' },
  { key: 'todayTomorrow', label: 'Денес и утре', color: '#16A34A' },
  { key: 'soon', label: 'Наскоро', color: '#5C6672' },
  { key: 'later', label: 'Подоцна овој месец', color: '#8A93A0' },
  { key: 'inProgress', label: 'Во тек · објавени', color: '#DB2777' },
];

const VIEW_SECTIONS: Record<View, UrgencyBucket[]> = {
  all: ['overdue', 'todayTomorrow', 'soon', 'later', 'inProgress'],
  late: ['overdue'],
  week: ['todayTomorrow', 'soon'],
};

interface MyTasksProps {
  tasks: TaskListItem[];
  clientById: Map<string, ClientRow>;
  openId: string | null;
  onOpen: (id: string) => void;
}

/** Мои задачи (Handoff §2.1): секции по итност + прегледи Сите мои / Доцни / Оваа недела. */
export function MyTasks({ tasks, clientById, openId, onOpen }: MyTasksProps) {
  const [view, setView] = useState<View>('all');
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const overdue = tasks.filter((t) => bucketOf(t) === 'overdue').length;

  const byBucket = (b: UrgencyBucket) => tasks.filter((t) => bucketOf(t) === b);
  const visibleSections = SECTIONS.filter((s) => VIEW_SECTIONS[view].includes(s.key));

  const counts: Record<View, number> = {
    all: tasks.length,
    late: overdue,
    week: byBucket('todayTomorrow').length + byBucket('soon').length,
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <p style={{ fontSize: 14, color: 'var(--gd-ink-secondary)', margin: '0 0 12px' }}>
        Имаш {tasks.length} задачи, {overdue} доцни.
      </p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        {(['all', 'late', 'week'] as View[]).map((v) => (
          <button key={v} onClick={() => setView(v)} style={viewChip(view === v)}>
            {v === 'all' ? 'Сите мои' : v === 'late' ? 'Доцни' : 'Оваа недела'} ({counts[v]})
          </button>
        ))}
      </div>

      {tasks.length === 0 && (
        <p style={{ color: 'var(--gd-ink-muted)' }}>Нема задачи за тебе во моментот.</p>
      )}

      {visibleSections.map((s) => {
        const rows = byBucket(s.key);
        if (rows.length === 0) return null;
        const isOpen = !collapsed.has(s.key);
        return (
          <div key={s.key} style={{ marginBottom: 20 }}>
            <button
              style={sectionHeader}
              onClick={() =>
                setCollapsed((c) => {
                  const n = new Set(c);
                  if (n.has(s.key)) n.delete(s.key);
                  else n.add(s.key);
                  return n;
                })
              }
            >
              {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              <span style={{ color: s.color }}>{s.label}</span>
              <span style={{ color: 'var(--gd-ink-muted)', fontWeight: 400 }}>· {rows.length}</span>
            </button>
            {isOpen && (
              <div style={card}>
                {rows.map((t) => {
                  const dl = deadlineFor(t);
                  return (
                    <button key={t.id} onClick={() => onOpen(t.id)} style={row(openId === t.id)}>
                      <span
                        style={{
                          width: 3,
                          height: 24,
                          borderRadius: 2,
                          background: clientById.get(t.clientId)?.color ?? '#ccc',
                          flex: '0 0 auto',
                        }}
                      />
                      <span style={rowTitle}>{t.title}</span>
                      <StatusBadge status={t.status} />
                      {dl && (
                        <span
                          style={{
                            fontSize: 12,
                            color: dlColor(dl.level),
                            width: 130,
                            textAlign: 'right',
                          }}
                        >
                          {dl.text}
                        </span>
                      )}
                      <span style={rowDate} title={fmtDate(t.slot?.date)}>
                        {relDate(t.slot?.date)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

const dlColor = (l: string) =>
  l === 'overdue' ? 'var(--gd-danger)' : l === 'soon' ? 'var(--gd-warning)' : 'var(--gd-ink-muted)';

const viewChip = (active: boolean): React.CSSProperties => ({
  height: 28,
  padding: '0 12px',
  borderRadius: 9999,
  border: '1px solid var(--gd-border)',
  background: active ? 'var(--gd-primary-tint)' : 'var(--gd-surface)',
  color: active ? 'var(--gd-primary-hover)' : 'var(--gd-ink-secondary)',
  fontSize: 12,
  fontWeight: active ? 600 : 500,
  cursor: 'pointer',
});
const sectionHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  border: 'none',
  background: 'transparent',
  fontSize: 14,
  fontWeight: 600,
  padding: '0 0 8px',
  cursor: 'pointer',
};
const card: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  background: 'var(--gd-surface)',
  overflow: 'hidden',
};
const row = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  height: 44,
  padding: '0 16px',
  border: 'none',
  borderLeft: active ? '2px solid var(--gd-primary)' : '2px solid transparent',
  borderBottom: '1px solid var(--gd-border)',
  background: active ? 'var(--gd-primary-tint)' : 'transparent',
  cursor: 'pointer',
});
const rowTitle: React.CSSProperties = {
  flex: 1,
  fontWeight: 500,
  fontSize: 14,
  textAlign: 'left',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const rowDate: React.CSSProperties = {
  width: 88,
  textAlign: 'right',
  color: 'var(--gd-ink-muted)',
  fontSize: 13,
  fontVariantNumeric: 'tabular-nums',
};
