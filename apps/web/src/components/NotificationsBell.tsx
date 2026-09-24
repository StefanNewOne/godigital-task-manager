import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Modal } from '@gd/ui';
import { useMarkRead, useNotifications } from '../api/notifications.js';
import type { NotificationRow } from '../lib/types.js';

const LEVEL_COLOR: Record<string, string> = {
  kritichen: 'var(--gd-danger)',
  alarm: 'var(--gd-warning)',
  potsetnik: 'var(--gd-ink-muted)',
};
const LEVEL_LABEL: Record<string, string> = {
  kritichen: 'Критичен',
  alarm: 'Аларм',
  potsetnik: 'Потсетник',
};

/** Каде води известувањето: конкретен таск/капа, инаку филтриран список по клиент. */
export function notificationTarget(
  n: Pick<NotificationRow, 'taskId' | 'groupId' | 'clientId'>,
): string {
  if (n.taskId) return `/tasks?task=${n.taskId}`;
  if (n.groupId) return `/tasks?capa=${n.groupId}`;
  if (n.clientId) return `/tasks?client=${n.clientId}&tab=list`;
  return '/tasks';
}

/** „Аларми" копче со број непрочитани + модал со известувањата (Handoff §11). */
export function NotificationsBell() {
  const { data } = useNotifications();
  const markRead = useMarkRead();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const items = data ?? [];

  const openNotification = (n: NotificationRow) => {
    markRead.mutate(n.id);
    setOpen(false);
    navigate(notificationTarget(n));
  };

  return (
    <>
      <button onClick={() => setOpen(true)} style={bellBtn} title="Аларми">
        Аларми
        {items.length > 0 && <span style={badge}>{items.length}</span>}
      </button>
      <Modal open={open} onClose={() => setOpen(false)} title="Аларми" width={420}>
        {items.length === 0 && (
          <div style={{ padding: '8px 0', color: 'var(--gd-ink-muted)', fontSize: 13 }}>
            Сè е во ред — нема отворени аларми.
          </div>
        )}
        {items.map((n) => (
          <div key={n.id} style={item}>
            <button onClick={() => openNotification(n)} style={itemBody} title="Отвори">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={levelPill(n.level)}>{LEVEL_LABEL[n.level] ?? n.level}</span>
                <span style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</span>
              </div>
              <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>{n.body}</div>
            </button>
            <button
              onClick={() => markRead.mutate(n.id)}
              style={readBtn}
              title="Означи прочитано"
              aria-label="Означи прочитано"
            >
              <Check size={14} />
            </button>
          </div>
        ))}
      </Modal>
    </>
  );
}

const bellBtn: React.CSSProperties = {
  position: 'relative',
  border: '1px solid var(--gd-border)',
  background: 'var(--gd-surface)',
  color: 'var(--gd-ink)',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  height: 32,
  padding: '0 12px',
  borderRadius: 8,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
};
const badge: React.CSSProperties = {
  background: 'var(--gd-danger)',
  color: '#fff',
  fontSize: 10,
  fontWeight: 700,
  borderRadius: 9999,
  padding: '1px 6px',
  lineHeight: '14px',
};
const item: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '10px 12px',
  borderBottom: '1px solid var(--gd-border)',
};
const itemBody: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  textAlign: 'left',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: 0,
};
const readBtn: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  background: 'var(--gd-surface)',
  borderRadius: 6,
  cursor: 'pointer',
  width: 26,
  height: 26,
  display: 'grid',
  placeItems: 'center',
  color: 'var(--gd-ink-muted)',
  alignSelf: 'center',
  flex: '0 0 auto',
};
const levelPill = (level: string): React.CSSProperties => ({
  fontSize: 11,
  fontWeight: 500,
  lineHeight: '16px',
  padding: '0 6px',
  borderRadius: 4,
  color: LEVEL_COLOR[level] ?? 'var(--gd-ink-muted)',
  border: `1px solid ${LEVEL_COLOR[level] ?? 'var(--gd-border)'}`,
  whiteSpace: 'nowrap',
  flex: '0 0 auto',
});
