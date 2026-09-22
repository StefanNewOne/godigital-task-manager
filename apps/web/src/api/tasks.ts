import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { TransitionPayload } from '@gd/core';
import { api } from '../lib/api.js';
import type { ActivityItem, TaskDetailData, TaskListItem } from '../lib/types.js';

export interface TaskFilters {
  clientId?: string;
  type?: 'video' | 'graphic';
  status?: string;
  month?: string;
  assigneeId?: string;
  q?: string;
}

function qs(filters: TaskFilters): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function useTasks(filters: TaskFilters = {}) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => api.get<TaskListItem[]>(`/tasks${qs(filters)}`),
  });
}

export function useTask(id: string | null) {
  return useQuery({
    queryKey: ['task', id],
    queryFn: () => api.get<TaskDetailData>(`/tasks/${id}`),
    enabled: !!id,
  });
}

export function useActivity(id: string | null) {
  return useQuery({
    queryKey: ['activity', id],
    queryFn: () => api.get<ActivityItem[]>(`/tasks/${id}/activity`),
    enabled: !!id,
  });
}

export function useTransition(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { to: string; payload?: TransitionPayload }) =>
      api.post<TaskDetailData>(`/tasks/${id}/transition`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['task', id] });
      void qc.invalidateQueries({ queryKey: ['activity', id] });
    },
  });
}

/** Преод преку Board DnD (динамичен id) — само за преоди без input-guards (D-8). */
export function useBoardTransition() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, to }: { id: string; to: string }) =>
      api.post(`/tasks/${id}/transition`, { to }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tasks'] }),
  });
}

export function useAddComment(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { body: string; mentions?: string[] }) =>
      api.post(`/tasks/${id}/comments`, input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['activity', id] }),
  });
}
