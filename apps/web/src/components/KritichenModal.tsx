import type React from 'react';
import { useNavigate } from 'react-router-dom';
import { useMarkRead, useNotifications } from '../api/notifications.js';
import { notificationTarget } from './NotificationsBell.js';

/**
 * Критичен модал (CLAUDE.md §16): непрочитан `kritichen` аларм блокира со модал што бара
 * „Видено". Не се затвора со backdrop/Escape — единствен излез е потврдата. Еден по еден.
 */
export function KritichenModal() {
  const { data } = useNotifications();
  const markRead = useMarkRead();
  const navigate = useNavigate();

  const crit = (data ?? []).find((n) => n.level === 'kritichen');
  if (!crit) return null;

  const acknowledge = (goTo: boolean) => {
    markRead.mutate(crit.id);
    if (goTo) navigate(notificationTarget(crit));
  };

  return (
    <div style={overlay} role="alertdialog" aria-modal="true" aria-label="Критичен аларм">
      <div style={panel}>
        <div style={badge}>Критичен</div>
        <h2 style={title}>{crit.title}</h2>
        <p style={body}>{crit.body}</p>
        <div style={actions}>
          {(crit.taskId || crit.groupId || crit.clientId) && (
            <button style={openBtn} onClick={() => acknowledge(true)}>
              {crit.taskId ? 'Отвори го таскот' : crit.groupId ? 'Отвори ја капата' : 'Отвори'}
            </button>
          )}
          <button style={seenBtn} onClick={() => acknowledge(false)} autoFocus>
            Видено
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(18,22,28,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
};
const panel: React.CSSProperties = {
  width: 440,
  maxWidth: 'calc(100vw - 32px)',
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-danger)',
  borderRadius: 12,
  padding: 24,
  boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
};
const badge: React.CSSProperties = {
  display: 'inline-block',
  fontSize: 11,
  fontWeight: 700,
  color: '#fff',
  background: 'var(--gd-danger)',
  borderRadius: 9999,
  padding: '2px 10px',
  marginBottom: 12,
};
const title: React.CSSProperties = { fontSize: 18, fontWeight: 600, margin: '0 0 8px' };
const body: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--gd-ink-secondary)',
  margin: '0 0 20px',
  lineHeight: 1.5,
};
const actions: React.CSSProperties = { display: 'flex', gap: 8, justifyContent: 'flex-end' };
const openBtn: React.CSSProperties = {
  height: 36,
  padding: '0 14px',
  border: '1px solid var(--gd-border)',
  background: 'var(--gd-surface)',
  color: 'var(--gd-ink)',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};
const seenBtn: React.CSSProperties = {
  height: 36,
  padding: '0 18px',
  border: 'none',
  background: 'var(--gd-danger)',
  color: '#fff',
  borderRadius: 8,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
};
