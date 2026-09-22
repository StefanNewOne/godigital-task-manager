import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import type { TaskGroupRow } from '../lib/types.js';

export interface TaskGroupFilters {
  clientId?: string;
  month?: string;
  type?: 'video' | 'graphic';
}

function qs(f: TaskGroupFilters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(f)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

/** Капа таскови (за капа-лентата во Список). */
export function useTaskGroups(filters: TaskGroupFilters = {}) {
  return useQuery({
    queryKey: ['task-groups', filters],
    queryFn: () => api.get<TaskGroupRow[]>(`/task-groups${qs(filters)}`),
  });
}
