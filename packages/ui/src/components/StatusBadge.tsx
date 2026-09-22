import type { CSSProperties } from 'react';
import { statusColor, statusText } from '../tokens.js';

/**
 * Статусен беџ (Handoff): точка во бојата на статусот + потемнет текст.
 * Презентациски — `label` (кирилица) го дава повикувачот од `@gd/core` TASK_STATUS_META.
 * `mrtov` е со испрекината рамка; `atRisk` го прави црвен (близу рок).
 */
export interface StatusBadgeProps {
  status: keyof typeof statusColor;
  label: string;
  dashed?: boolean;
  atRisk?: boolean;
}

export function StatusBadge({ status, label, dashed, atRisk }: StatusBadgeProps) {
  const dot = atRisk ? '#DC2626' : statusColor[status];
  const text = atRisk ? '#B91C1C' : statusText[status];
  const style: CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    height: 20,
    padding: '0 8px',
    borderRadius: 4,
    fontSize: 12,
    lineHeight: '16px',
    fontWeight: 500,
    color: text,
    background: 'transparent',
    border: dashed ? `1px dashed ${dot}` : '1px solid transparent',
    whiteSpace: 'nowrap',
  };
  return (
    <span style={style}>
      <span
        style={{ width: 6, height: 6, borderRadius: '50%', background: dot, flex: '0 0 auto' }}
        aria-hidden
      />
      {label}
    </span>
  );
}
