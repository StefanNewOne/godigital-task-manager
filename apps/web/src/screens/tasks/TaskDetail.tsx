import type React from 'react';
import { useState } from 'react';
import {
  ROLE_LABEL,
  TASK_STATUS_META,
  allowedTaskTargets,
  findTaskTransition,
  type ContentType,
  type TaskStatus,
} from '@gd/core';
import { useEmployees } from '../../api/admin.js';
import { useActivity, useAddComment, useTask, useTransition } from '../../api/tasks.js';
import { ApiRequestError } from '../../lib/api.js';
import { StatusBadge } from '../../components/StatusBadge.js';

export function TaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { data: task } = useTask(taskId);
  const { data: activity } = useActivity(taskId);
  const { data: employees } = useEmployees();
  const transition = useTransition(taskId);
  const addComment = useAddComment(taskId);

  const [comment, setComment] = useState('');
  const [assigneeId, setAssigneeId] = useState('');
  const [newComment, setNewComment] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  if (!task) {
    return (
      <aside style={panel}>
        <div style={{ padding: 24, color: 'var(--gd-ink-muted)' }}>Вчитување…</div>
      </aside>
    );
  }

  const targets = allowedTaskTargets(task.status as TaskStatus, task.contentType as ContentType);
  const empName = (id: string | null) =>
    id ? (employees?.find((e) => e.id === id)?.name ?? '—') : 'Недоделен';

  const doTransition = (to: string) => {
    transition.mutate(
      { to, payload: { comment: comment || undefined, assigneeId: assigneeId || undefined } },
      {
        onSuccess: () => {
          setComment('');
          setAssigneeId('');
          setToast('Статусот е сменет.');
        },
        onError: (e) => setToast(e instanceof ApiRequestError ? e.message : 'Грешка.'),
      },
    );
  };

  return (
    <aside style={panel}>
      {/* Header */}
      <div style={header}>
        <StatusBadge status={task.status} />
        <button onClick={onClose} style={iconBtn} title="Затвори">
          ✕
        </button>
      </div>

      <div style={{ overflow: 'auto', flex: 1 }}>
        <div style={{ padding: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 16px' }}>{task.title}</h2>

          {/* Мета */}
          <dl style={metaGrid}>
            <dt style={dt}>Клиент</dt>
            <dd style={dd}>{task.client.name}</dd>
            <dt style={dt}>Тип</dt>
            <dd style={dd}>{task.contentType === 'video' ? 'Видео' : 'Графика'}</dd>
            <dt style={dt}>Доделен</dt>
            <dd style={dd}>{empName(task.assigneeId)}</dd>
            <dt style={dt}>Датум на објава</dt>
            <dd style={dd}>{task.slot ? task.slot.date.slice(0, 10) : '—'}</dd>
            <dt style={dt}>Верзија</dt>
            <dd style={dd}>v{task.version}</dd>
          </dl>

          {/* Работна зона (matrix-driven) */}
          <div style={workZone}>
            <div style={workHeader}>Работна зона · носи {ownerLabel(task.status)}</div>
            {targets.length === 0 ? (
              <p style={{ color: 'var(--gd-ink-muted)', fontSize: 13, margin: 0 }}>
                Нема достапни преоди за овој статус.
              </p>
            ) : (
              <>
                <label style={fieldLabel}>
                  Доделен (по потреба)
                  <select
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    style={input}
                  >
                    <option value="">—</option>
                    {(employees ?? []).map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.name} · {e.role}
                      </option>
                    ))}
                  </select>
                </label>
                <label style={fieldLabel}>
                  Коментар (за враќање/измени)
                  <textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    rows={2}
                    style={{ ...input, height: 'auto', padding: 8 }}
                  />
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {targets.map((to) => {
                    const rule = findTaskTransition(
                      task.status as TaskStatus,
                      to,
                      task.contentType as ContentType,
                    );
                    const isReturn = rule?.effects.some((x) => x.startsWith('E_REVISION'));
                    return (
                      <button
                        key={to}
                        onClick={() => doTransition(to)}
                        disabled={transition.isPending}
                        style={isReturn ? dangerBtn : primaryBtn}
                      >
                        → {TASK_STATUS_META[to].label}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>

          {/* Активност */}
          <h3 style={sectionTitle}>Активност</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
            {(activity ?? []).map((a, i) => (
              <div key={i} style={{ fontSize: 13 }}>
                <span style={{ color: 'var(--gd-ink-muted)' }}>
                  {a.at.slice(0, 16).replace('T', ' ')} ·{' '}
                </span>
                {a.kind === 'comment' ? <strong>{a.text}</strong> : a.text}
              </div>
            ))}
            {(activity ?? []).length === 0 && (
              <div style={{ fontSize: 13, color: 'var(--gd-ink-muted)' }}>
                Сè уште нема активност.
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Додади коментар…"
              style={{ ...input, flex: 1 }}
            />
            <button
              onClick={() =>
                newComment.trim() &&
                addComment.mutate({ body: newComment }, { onSuccess: () => setNewComment('') })
              }
              style={primaryBtn}
            >
              Прати
            </button>
          </div>
        </div>
      </div>

      {toast && (
        <div style={toastStyle} onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </aside>
  );
}

function ownerLabel(status: string): string {
  const owner = TASK_STATUS_META[status as TaskStatus]?.owner;
  return owner ? ROLE_LABEL[owner] : 'никој';
}

const panel: React.CSSProperties = {
  width: 480,
  borderLeft: '1px solid var(--gd-border)',
  background: 'var(--gd-surface)',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
};
const header: React.CSSProperties = {
  height: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  borderBottom: '1px solid var(--gd-border)',
};
const iconBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 16,
  color: 'var(--gd-ink-muted)',
};
const metaGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  rowGap: 8,
  margin: '0 0 20px',
  fontSize: 14,
};
const dt: React.CSSProperties = { color: 'var(--gd-ink-muted)', fontSize: 13 };
const dd: React.CSSProperties = { margin: 0 };
const workZone: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  overflow: 'hidden',
  marginBottom: 20,
};
const workHeader: React.CSSProperties = {
  background: 'var(--gd-surface-alt)',
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--gd-ink-muted)',
  borderBottom: '1px solid var(--gd-border)',
};
const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--gd-ink-muted)',
  padding: '8px 12px 0',
};
const input: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: 36,
  marginTop: 4,
  border: '1px solid var(--gd-border)',
  borderRadius: 6,
  padding: '0 8px',
  boxSizing: 'border-box',
  fontSize: 14,
};
const sectionTitle: React.CSSProperties = { fontSize: 14, fontWeight: 600, margin: '0 0 8px' };
const primaryBtn: React.CSSProperties = {
  height: 32,
  padding: '0 12px',
  background: 'var(--gd-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
};
const dangerBtn: React.CSSProperties = {
  ...primaryBtn,
  background: 'var(--gd-surface)',
  color: 'var(--gd-danger-text)',
  border: '1px solid var(--gd-danger)',
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
