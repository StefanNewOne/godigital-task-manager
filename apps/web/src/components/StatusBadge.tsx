import { TASK_STATUS_META, type TaskStatus } from '@gd/core';
import { StatusBadge as UiStatusBadge, tokens } from '@gd/ui';

/**
 * Беџ со статус — тенок адаптер врз @gd/ui StatusBadge: ја зема кирилската етикета
 * од TASK_STATUS_META, ги префрла бојата/потемнетиот текст од токените. `mrtov` е
 * со испрекината рамка (резервиран слот). `atRisk` го прави црвен (близу рок).
 */
export function StatusBadge({ status, atRisk }: { status: string; atRisk?: boolean }) {
  const key = status as keyof typeof tokens.statusColor;
  const label = TASK_STATUS_META[status as TaskStatus]?.label ?? status;
  return <UiStatusBadge status={key} label={label} dashed={status === 'mrtov'} atRisk={atRisk} />;
}
