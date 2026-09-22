import { TASK_STATUS_META, type TaskStatus } from '@gd/core';
import { tokens } from '@gd/ui';

/** Беџ со статус — точка во семантичка боја + етикета (Handoff §5 Чипови). */
export function StatusBadge({ status }: { status: string }) {
  const meta = TASK_STATUS_META[status as TaskStatus];
  const color = tokens.statusColor[status as keyof typeof tokens.statusColor] ?? '#6B7280';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        height: 22,
        padding: '0 8px',
        borderRadius: 4,
        fontSize: 12,
        fontWeight: 500,
        color,
        background: `${color}1a`, // ~10% алфа
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {meta?.label ?? status}
    </span>
  );
}
