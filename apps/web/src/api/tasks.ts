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

/** Дополнителен (екстра) таск во постоечка капа (прототип „Ново видео/графика"). */
export function useCreateExtraTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      clientId: string;
      contentType: 'video' | 'graphic';
      title: string;
      date: string;
    }) => api.post<TaskDetailData>('/tasks/extra', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['tasks'] });
      void qc.invalidateQueries({ queryKey: ['task-groups'] });
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

/** Заеднички invalidation за акции врз еден таск. */
function invalidateTask(qc: ReturnType<typeof useQueryClient>, id: string) {
  void qc.invalidateQueries({ queryKey: ['tasks'] });
  void qc.invalidateQueries({ queryKey: ['task', id] });
  void qc.invalidateQueries({ queryKey: ['activity', id] });
}

/** Пауза (dir/am, причина задолжителна). */
export function usePause(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string }) =>
      api.post<TaskDetailData>(`/tasks/${id}/pause`, input),
    onSuccess: () => invalidateTask(qc, id),
  });
}

/** Откажување (само dir, причина задолжителна). */
export function useCancel(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { reason: string }) =>
      api.post<TaskDetailData>(`/tasks/${id}/cancel`, input),
    onSuccess: () => invalidateTask(qc, id),
  });
}

/** Враќање од пауза (dir/am) — нов датум/слот. */
export function useResume(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { newDate: string; orderInDay?: number }) =>
      api.post<TaskDetailData>(`/tasks/${id}/resume`, input),
    onSuccess: () => invalidateTask(qc, id),
  });
}

/** Промена на датум (dir/am/сопственик по тип) — нов датум + причина. */
export function useDateChange(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { newDate: string; orderInDay?: number; reason: string }) =>
      api.post<TaskDetailData>(`/tasks/${id}/date-change`, input),
    onSuccess: () => invalidateTask(qc, id),
  });
}

export interface PublicationInput {
  platform: 'fb' | 'ig' | 'tiktok';
  postType: 'reel' | 'post' | 'story' | 'carousel';
  permalink?: string;
  publishedAt?: string;
}

/** Објава по платформа (задоволува G_PUBLICATION за „За објавување"). */
export function useAddPublication(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: PublicationInput) => api.post(`/tasks/${id}/publications`, input),
    onSuccess: () => invalidateTask(qc, id),
  });
}

/** Одлука за промоција по објава (органски/платено) — задоволува G_DECISION. */
export function usePromotion(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      publicationId,
      decision,
    }: {
      publicationId: string;
      decision: 'organic' | 'paid';
    }) => api.post(`/publications/${publicationId}/promotion`, { decision }),
    onSuccess: () => invalidateTask(qc, taskId),
  });
}
