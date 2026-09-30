import type React from 'react';

/** Заеднички стилови за auth екраните (Login / Заборавена лозинка / Нова лозинка). */
export const wrap: React.CSSProperties = {
  display: 'flex',
  minHeight: '100vh',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--gd-surface-alt)',
};

export const card: React.CSSProperties = {
  width: 360,
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-border)',
  borderRadius: 'var(--gd-radius-card)',
  padding: 24,
  display: 'flex',
  flexDirection: 'column',
  gap: 16,
};

export const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: 36,
  marginTop: 4,
  padding: '0 10px',
  border: '1px solid var(--gd-border)',
  borderRadius: 'var(--gd-radius-field)',
  fontSize: 14,
  boxSizing: 'border-box',
};

export const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--gd-ink-muted)',
};

export const errStyle: React.CSSProperties = {
  display: 'block',
  marginTop: 4,
  color: 'var(--gd-danger-text)',
  fontSize: 12,
  fontWeight: 400,
};

export const btnStyle: React.CSSProperties = {
  height: 36,
  background: 'var(--gd-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--gd-radius-button)',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};

export const linkStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--gd-primary)',
  textDecoration: 'none',
  textAlign: 'center',
};

export const okStyle: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--gd-ink-secondary)',
  lineHeight: 1.5,
};
