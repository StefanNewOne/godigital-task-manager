import type React from 'react';
import { useState } from 'react';
import {
  ALL_STATUSES,
  TASK_STATUS_META,
  isBoardDraggable,
  type ContentType,
  type TaskStatus,
} from '@gd/core';
import { tokens } from '@gd/ui';
import { useBoardTransition, useTasks } from '../../api/tasks.js';
import { ApiRequestError } from '../../lib/api.js';
import type { TaskListItem } from '../../lib/types.js';

/**
 * Табла (Handoff §3, D-8): колони по статус, drag-and-drop само за преоди без input-guards.
 * Преоди што бараат внес (доделен/коментар) се одбиваат со toast — отвори го панелот.
 */
export function Board({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: tasks } = useTasks({});
  const move = useBoardTransition();
  const [drag, setDrag] = useState<{ id: string; from: string; type: ContentType } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const rows = tasks ?? [];
  const columns = ALL_STATUSES.filter((s) => rows.some((t) => t.status === s));

  const drop = (to: TaskStatus) => {
    setOver(null);
    if (!drag) return;
    const d = drag;
    setDrag(null);
    if (d.from === to) return;
    if (!isBoardDraggable(d.from as TaskStatus, to, d.type)) {
      setToast('Овој преод бара внес — отвори го панелот.');
      return;
    }
    move.mutate(
      { id: d.id, to },
      { onError: (e) => setToast(e instanceof ApiRequestError ? e.message : 'Грешка.') },
    );
  };

  return (
    <div style={{ display: 'flex', gap: 16, overflowX: 'auto', height: '100%', padding: '4px 0' }}>
      {columns.map((status) => {
        const cards = rows.filter((t) => t.status === status);
        const color = tokens.statusColor[status as keyof typeof tokens.statusColor] ?? '#6B7280';
        return (
          <div
            key={status}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(status);
            }}
            onDrop={() => drop(status)}
            style={column(over === status)}
          >
            <div style={colHeader}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              {TASK_STATUS_META[status].label}
              <span style={{ color: 'var(--gd-ink-muted)', fontWeight: 400 }}>
                · {cards.length}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
              {cards.map((t) => (
                <Card
                  key={t.id}
                  task={t}
                  onOpen={onOpen}
                  onDragStart={() => setDrag({ id: t.id, from: t.status, type: t.contentType })}
                />
              ))}
            </div>
          </div>
        );
      })}
      {columns.length === 0 && <p style={{ color: 'var(--gd-ink-muted)' }}>Нема таскови.</p>}
      {toast && (
        <div style={toastStyle} onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  );
}

function Card({
  task,
  onOpen,
  onDragStart,
}: {
  task: TaskListItem;
  onOpen: (id: string) => void;
  onDragStart: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={() => onOpen(task.id)}
      style={cardStyle}
      title={task.title}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {task.contentType === 'video' ? '▶' : '▧'} {task.title}
      </div>
      <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)', marginTop: 4 }}>
        {task.slot ? task.slot.date.slice(0, 10) : '—'} · v{task.version}
      </div>
    </div>
  );
}

const column = (isOver: boolean): React.CSSProperties => ({
  minWidth: 300,
  width: 300,
  background: 'var(--gd-surface-alt)',
  border: `1px solid ${isOver ? 'var(--gd-primary-border)' : 'var(--gd-border)'}`,
  borderRadius: 8,
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
});
const colHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
  fontWeight: 600,
  padding: '4px 4px 8px',
};
const cardStyle: React.CSSProperties = {
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  padding: 12,
  cursor: 'grab',
};
const toastStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 20,
  right: 20,
  background: 'var(--gd-ink)',
  color: '#fff',
  padding: '10px 16px',
  borderRadius: 8,
  fontSize: 14,
  cursor: 'pointer',
};
