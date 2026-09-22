import type React from 'react';

/** Заеднички inline стилови за read-only табели (по Handoff §5 Табела). */
export const tableStyles = {
  wrap: {
    background: 'var(--gd-surface)',
    border: '1px solid var(--gd-border)',
    borderRadius: 'var(--gd-radius-card)',
    overflow: 'hidden',
  } as React.CSSProperties,
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 } as React.CSSProperties,
  th: {
    textAlign: 'left',
    padding: '10px 16px',
    background: 'var(--gd-surface-alt)',
    color: 'var(--gd-ink-muted)',
    fontSize: 12,
    fontWeight: 500,
    borderBottom: '1px solid var(--gd-border)',
  } as React.CSSProperties,
  td: {
    padding: '10px 16px',
    borderBottom: '1px solid var(--gd-border)',
  } as React.CSSProperties,
  h1: { fontSize: 20, fontWeight: 600, margin: '0 0 16px' } as React.CSSProperties,
};
