import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ScenarioOutcomesInput, ScenarioSplitInput, TransitionPayload } from '@gd/core';
import { api } from '../lib/api.js';
import type { ScenarioRow, TaskGroupDetail, TaskGroupRow } from '../lib/types.js';

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

/** Единечна капа (за Капа панелот). */
export function useTaskGroup(id: string | null) {
  return useQuery({
    queryKey: ['task-group', id],
    queryFn: () => api.get<TaskGroupDetail>(`/task-groups/${id}`),
    enabled: !!id,
  });
}

/** Сценарија на капата (видео A4). */
export function useScenarios(id: string | null) {
  return useQuery({
    queryKey: ['scenarios', id],
    queryFn: () => api.get<ScenarioRow[]>(`/task-groups/${id}/scenarios`),
    enabled: !!id,
  });
}

function useGroupInvalidator(id: string) {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ['task-groups'] });
    void qc.invalidateQueries({ queryKey: ['task-group', id] });
    void qc.invalidateQueries({ queryKey: ['scenarios', id] });
    void qc.invalidateQueries({ queryKey: ['tasks'] });
  };
}

export function useGroupTransition(id: string) {
  const invalidate = useGroupInvalidator(id);
  return useMutation({
    mutationFn: (input: { to: string; payload?: TransitionPayload }) =>
      api.post<TaskGroupRow>(`/task-groups/${id}/transition`, input),
    onSuccess: invalidate,
  });
}

export function useBulkActivate(id: string) {
  const invalidate = useGroupInvalidator(id);
  return useMutation({
    mutationFn: () => api.post<{ activated: number }>(`/task-groups/${id}/activate-all`, {}),
    onSuccess: invalidate,
  });
}

export function useSplitScenarios(id: string) {
  const invalidate = useGroupInvalidator(id);
  return useMutation({
    mutationFn: (input: ScenarioSplitInput) =>
      api.post<ScenarioRow[]>(`/task-groups/${id}/scenarios`, input),
    onSuccess: invalidate,
  });
}

/** Продолжи го животот на суровиот материјал за +30 дена (H7). */
export function useExtendStorage(id: string) {
  const invalidate = useGroupInvalidator(id);
  return useMutation({
    mutationFn: () => api.post<TaskGroupRow>(`/task-groups/${id}/storage/extend`, {}),
    onSuccess: invalidate,
  });
}

/** Означи локална архива на суровиот материјал (H7). */
export function useArchiveStorage(id: string) {
  const invalidate = useGroupInvalidator(id);
  return useMutation({
    mutationFn: (path: string) =>
      api.post<TaskGroupRow>(`/task-groups/${id}/storage/archive`, { path }),
    onSuccess: invalidate,
  });
}

export function useScenarioOutcomes(id: string) {
  const invalidate = useGroupInvalidator(id);
  return useMutation({
    mutationFn: (input: ScenarioOutcomesInput) =>
      api.post<ScenarioRow[]>(`/task-groups/${id}/scenario-outcomes`, input),
    onSuccess: invalidate,
  });
}
