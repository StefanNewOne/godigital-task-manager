import type React from 'react';

/** Мобилно-прв, тенок layout за клиентскиот PWA (одделен од employee nav). */
export const page: React.CSSProperties = {
  minHeight: '100vh',
  background: 'var(--gd-surface-alt)',
  display: 'flex',
  flexDirection: 'column',
};

export const header: React.CSSProperties = {
  height: 52,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  background: 'var(--gd-surface)',
  borderBottom: '1px solid var(--gd-border)',
};

export const brand: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--gd-ink)',
};

export const container: React.CSSProperties = {
  width: '100%',
  maxWidth: 560,
  margin: '0 auto',
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  boxSizing: 'border-box',
};

export const listCard: React.CSSProperties = {
  display: 'block',
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-border)',
  borderRadius: 'var(--gd-radius-card)',
  padding: 14,
  textDecoration: 'none',
  color: 'inherit',
};

export const cardTitle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 600,
  color: 'var(--gd-ink)',
  margin: 0,
};

export const metaRow: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  alignItems: 'center',
  marginTop: 8,
  fontSize: 12,
  color: 'var(--gd-ink-muted)',
};

export const muted: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--gd-ink-secondary)',
  lineHeight: 1.5,
};

export const textarea: React.CSSProperties = {
  width: '100%',
  minHeight: 88,
  padding: 10,
  border: '1px solid var(--gd-border)',
  borderRadius: 'var(--gd-radius-field)',
  fontSize: 14,
  fontFamily: 'inherit',
  boxSizing: 'border-box',
  resize: 'vertical',
};

export const actionsRow: React.CSSProperties = {
  display: 'flex',
  gap: 10,
  marginTop: 16,
};

export const primaryBtn: React.CSSProperties = {
  flex: 1,
  height: 44,
  background: 'var(--gd-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--gd-radius-button)',
  fontSize: 15,
  fontWeight: 500,
  cursor: 'pointer',
};

export const secondaryBtn: React.CSSProperties = {
  flex: 1,
  height: 44,
  background: 'var(--gd-surface)',
  color: 'var(--gd-ink)',
  border: '1px solid var(--gd-border)',
  borderRadius: 'var(--gd-radius-button)',
  fontSize: 15,
  fontWeight: 500,
  cursor: 'pointer',
};

export const linkBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: 'var(--gd-primary)',
  fontSize: 13,
  cursor: 'pointer',
  padding: 0,
};

export const errStyleInline: React.CSSProperties = {
  display: 'block',
  marginTop: 8,
  color: 'var(--gd-danger-text)',
  fontSize: 12,
};

export const toastBox: React.CSSProperties = {
  position: 'fixed',
  left: '50%',
  bottom: 20,
  transform: 'translateX(-50%)',
  background: '#12161C',
  color: '#fff',
  padding: '10px 16px',
  borderRadius: 8,
  fontSize: 13,
  boxShadow: 'var(--gd-shadow-toast)',
  zIndex: 91,
};
