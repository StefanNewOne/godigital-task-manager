import type React from 'react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Modal } from '@gd/ui';
import { useMarkRead, useNotifications } from '../api/notifications.js';
import type { NotificationRow } from '../lib/types.js';

const LEVEL_COLOR: Record<string, string> = {
  kritichen: 'var(--gd-danger)',
  alarm: 'var(--gd-warning)',
  potsetnik: 'var(--gd-ink-muted)',
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
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: LEVEL_COLOR[n.level],
                marginTop: 6,
                flex: '0 0 auto',
              }}
            />
            <button onClick={() => openNotification(n)} style={itemBody} title="Отвори">
              <div style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
              <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>{n.body}</div>
            </button>
            <button onClick={() => markRead.mutate(n.id)} style={readBtn} title="Означи прочитано">
              ✓
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
  fontSize: 12,
  height: 24,
  alignSelf: 'center',
};
