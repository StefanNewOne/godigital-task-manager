import type React from 'react';
import { useState } from 'react';
import {
  ALL_STATUSES,
  ROLE_LABEL,
  TASK_STATUS_META,
  isBoardDraggable,
  ownerOf,
  type ContentType,
  type TaskStatus,
} from '@gd/core';
import { tokens } from '@gd/ui';
import { MessageSquare, MoreHorizontal, Paperclip } from 'lucide-react';
import { daysLabel } from '../../lib/format.js';
import { useBoardTransition } from '../../api/tasks.js';
import { ApiRequestError } from '../../lib/api.js';
import type { ClientRow, EmployeeRow, TaskListItem } from '../../lib/types.js';
import { daysInStatus, deadlineFor } from '../../lib/tasksView.js';
import { StatusBadge } from '../../components/StatusBadge.js';

interface BoardProps {
  tasks: TaskListItem[];
  clientById: Map<string, ClientRow>;
  empById: Map<string, EmployeeRow>;
  groupBy: 'client' | 'status';
  onOpen: (id: string) => void;
}

/** Табла (Handoff §2.3, D-8): групирање по статус или по клиент; DnD со guard-одбивање. */
export function Board({ tasks, clientById, empById, groupBy, onOpen }: BoardProps) {
  const move = useBoardTransition();
  const [drag, setDrag] = useState<{ id: string; from: string; type: ContentType } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const drop = (to: TaskStatus) => {
    setOver(null);
    const d = drag;
    setDrag(null);
    if (!d || d.from === to) return;
    if (!isBoardDraggable(d.from as TaskStatus, to, d.type)) {
      setToast(`Преодот „${label(d.from)}" → „${label(to)}" бара внес — отвори го панелот.`);
      return;
    }
    move.mutate(
      { id: d.id, to },
      { onError: (e) => setToast(e instanceof ApiRequestError ? e.message : 'Грешка.') },
    );
  };

  // Групирање по статус (D-8: default кога е избран еден клиент) или по клиент.
  const columns: Array<{ key: string; title: string; color: string; cards: TaskListItem[] }> =
    groupBy === 'status'
      ? ALL_STATUSES.filter((s) => tasks.some((t) => t.status === s)).map((s) => ({
          key: s,
          title: TASK_STATUS_META[s].label,
          color: tokens.statusColor[s as keyof typeof tokens.statusColor] ?? '#6B7280',
          cards: tasks.filter((t) => t.status === s),
        }))
      : [...new Set(tasks.map((t) => t.clientId))].map((cid) => ({
          key: cid,
          title: clientById.get(cid)?.name ?? 'Клиент',
          color: clientById.get(cid)?.color ?? '#6B7280',
          cards: tasks.filter((t) => t.clientId === cid),
        }));

  return (
    <div style={boardWrap}>
      {columns.map((col) => (
        <div
          key={col.key}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            setOver(col.key);
          }}
          onDrop={() => {
            if (groupBy === 'status') {
              drop(col.key as TaskStatus);
            } else if (drag) {
              setToast('Групирај „по статус" за да менуваш статус со влечење.');
              setDrag(null);
              setOver(null);
            }
          }}
          style={column(
            over === col.key && groupBy === 'status',
            dropColor(drag, col.key, groupBy),
          )}
        >
          <div style={colHeader}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: col.color }} />
            {col.title}
            <span style={{ color: 'var(--gd-ink-muted)', fontWeight: 400 }}>
              · {col.cards.length}
            </span>
            <MoreHorizontal
              size={14}
              style={{ marginLeft: 'auto', color: 'var(--gd-ink-muted)' }}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
            {col.cards.map((t) => (
              <Card
                key={t.id}
                task={t}
                stripe={clientById.get(t.clientId)?.color ?? '#ccc'}
                empById={empById}
                dragging={drag?.id === t.id}
                onOpen={onOpen}
                onDragStart={() => setDrag({ id: t.id, from: t.status, type: t.contentType })}
                onDragEnd={() => setDrag(null)}
              />
            ))}
          </div>
        </div>
      ))}
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
  stripe,
  empById,
  dragging,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  task: TaskListItem;
  stripe: string;
  empById: Map<string, EmployeeRow>;
  dragging: boolean;
  onOpen: (id: string) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const dl = deadlineFor(task);
  const stuck = daysInStatus(task);
  const owner = ownerOf(task.status as TaskStatus, task.contentType as ContentType);
  const assigneeEmp = task.assigneeId ? empById.get(task.assigneeId) : undefined;
  const assignee = assigneeEmp?.name ?? null;
  const urgent = task.priority === 'iten';
  return (
    <div
      draggable
      onDragStart={(e) => {
        // setData/effectAllowed се потребни за да стартува HTML5 DnD доследно низ прелистувачи.
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', task.id);
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      onClick={() => onOpen(task.id)}
      style={{ ...cardStyle, opacity: dragging ? 0.4 : 1 }}
      title={task.title}
    >
      <span style={{ ...cardStripe, background: stripe }} />
      {urgent && <span style={urgentTriangle} aria-label="итно" />}
      <div style={cardTitle}>{task.title}</div>
      <div style={{ margin: '6px 0' }}>
        <StatusBadge status={task.status} />
      </div>
      {owner && (
        <div
          style={{
            fontSize: 12,
            color: 'var(--gd-ink-muted)',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          {assigneeEmp ? (
            <span style={cardAvatar(assigneeEmp.color)}>{cardInitials(assigneeEmp.name)}</span>
          ) : (
            <span style={cardAvatarEmpty} />
          )}
          <span>
            {ROLE_LABEL[owner]} · {assignee ?? 'Недоделен'}
          </span>
        </div>
      )}
      <div style={cardMeta}>
        {dl && (
          <span style={{ color: dlColor(dl.level) }}>
            {dlPrefix(dl.level)}
            {dl.text}
          </span>
        )}
        {task._count.comments > 0 && (
          <span style={metaItem}>
            <MessageSquare size={12} /> {task._count.comments}
          </span>
        )}
        {task._count.publications > 0 && (
          <span style={metaItem}>
            <Paperclip size={12} /> {task._count.publications}
          </span>
        )}
        {task.version > 1 && <span>v.{task.version}</span>}
        {stuck > 3 && !['objaveno', 'zavrseno', 'otkazano', 'pauza'].includes(task.status) && (
          <span style={{ color: 'var(--gd-warning)' }}>◷ {daysLabel(stuck)} во статус</span>
        )}
      </div>
    </div>
  );
}

const label = (s: string) => TASK_STATUS_META[s as TaskStatus]?.label ?? s;
const dlColor = (l: string) =>
  l === 'overdue' ? 'var(--gd-danger)' : l === 'soon' ? 'var(--gd-warning)' : 'var(--gd-ink-muted)';
const dlPrefix = (l: string) => (l === 'overdue' ? '⚠ ' : l === 'soon' ? '◷ ' : '');

function cardInitials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}
const cardAvatar = (bg: string): React.CSSProperties => ({
  width: 20,
  height: 20,
  borderRadius: '50%',
  background: bg,
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 9,
  fontWeight: 600,
  flex: '0 0 auto',
});
const cardAvatarEmpty: React.CSSProperties = {
  width: 20,
  height: 20,
  borderRadius: '50%',
  background: 'var(--gd-surface-alt)',
  border: '1px solid var(--gd-border)',
  flex: '0 0 auto',
};

/** Боја на drop-целта: зелена ако преодот е дозволен, црвена ако не (D-8). */
function dropColor(
  drag: { from: string; type: ContentType } | null,
  colKey: string,
  groupBy: 'client' | 'status',
): string | null {
  if (!drag || groupBy !== 'status') return null;
  if (drag.from === colKey) return null;
  return isBoardDraggable(drag.from as TaskStatus, colKey as TaskStatus, drag.type)
    ? '#16A34A'
    : '#DC2626';
}

const boardWrap: React.CSSProperties = {
  display: 'flex',
  gap: 16,
  overflowX: 'auto',
  height: '100%',
  padding: '4px 0',
};
const column = (isOver: boolean, dropClr: string | null): React.CSSProperties => ({
  minWidth: 300,
  width: 300,
  background: 'var(--gd-surface-alt)',
  border: `1px ${isOver ? 'dashed' : 'solid'} ${
    dropClr ?? (isOver ? 'var(--gd-primary-border)' : 'var(--gd-border)')
  }`,
  borderRadius: 8,
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  flex: '0 0 auto',
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
  position: 'relative',
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  padding: '12px 12px 12px 16px',
  cursor: 'grab',
  overflow: 'hidden',
};
const cardStripe: React.CSSProperties = {
  position: 'absolute',
  left: 0,
  top: 0,
  bottom: 0,
  width: 4,
};
const urgentTriangle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  right: 0,
  width: 0,
  height: 0,
  borderTop: '14px solid #DC2626',
  borderLeft: '14px solid transparent',
};
const cardTitle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
};
const cardMeta: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginTop: 8,
  fontSize: 12,
  color: 'var(--gd-ink-muted)',
  fontVariantNumeric: 'tabular-nums',
};
const metaItem: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 3 };
const toastStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 20,
  right: 20,
  background: '#12161C',
  color: '#fff',
  padding: '10px 16px',
  borderRadius: 8,
  fontSize: 14,
  cursor: 'pointer',
  zIndex: 50,
};
