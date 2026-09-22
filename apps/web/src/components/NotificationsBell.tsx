import type React from 'react';
import { useState } from 'react';
import { useMarkRead, useNotifications } from '../api/notifications.js';

const LEVEL_COLOR: Record<string, string> = {
  kritichen: 'var(--gd-danger)',
  alarm: 'var(--gd-warning)',
  potsetnik: 'var(--gd-ink-muted)',
};

/** Ѕвонче за известувања со број непрочитани + паѓачки панел (Handoff §11). */
export function NotificationsBell() {
  const { data } = useNotifications();
  const markRead = useMarkRead();
  const [open, setOpen] = useState(false);
  const items = data ?? [];

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen((o) => !o)} style={bellBtn} title="Известувања">
        🔔
        {items.length > 0 && <span style={badge}>{items.length}</span>}
      </button>
      {open && (
        <div style={panel}>
          <div style={panelHead}>Известувања</div>
          {items.length === 0 && (
            <div style={{ padding: 16, color: 'var(--gd-ink-muted)', fontSize: 13 }}>
              Сè е во ред.
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
                }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 500 }}>{n.title}</div>
                <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>{n.body}</div>
              </div>
              <button
                onClick={() => markRead.mutate(n.id)}
                style={readBtn}
                title="Означи прочитано"
              >
                ✓
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const bellBtn: React.CSSProperties = {
  position: 'relative',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 16,
};
const badge: React.CSSProperties = {
  position: 'absolute',
  top: -4,
  right: -6,
  background: 'var(--gd-danger)',
  color: '#fff',
  fontSize: 10,
  fontWeight: 700,
  borderRadius: 9999,
  padding: '1px 5px',
};
const panel: React.CSSProperties = {
  position: 'absolute',
  top: 32,
  right: 0,
  width: 320,
  maxHeight: 400,
  overflowY: 'auto',
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  boxShadow: 'var(--gd-shadow-popover)',
  zIndex: 10,
};
const panelHead: React.CSSProperties = {
  padding: '10px 12px',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--gd-ink-muted)',
  borderBottom: '1px solid var(--gd-border)',
};
const item: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: '10px 12px',
  borderBottom: '1px solid var(--gd-border)',
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
