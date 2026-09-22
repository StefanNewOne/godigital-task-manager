import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import type { NotificationRow, RuleRow } from '../lib/types.js';

export function useNotifications() {
  return useQuery({
    queryKey: ['notifications'],
    queryFn: () => api.get<NotificationRow[]>('/notifications?unread=1'),
    refetchInterval: 60_000,
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/notifications/${id}/read`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

export function useRules() {
  return useQuery({ queryKey: ['rules'], queryFn: () => api.get<RuleRow[]>('/automation-rules') });
}

export function useToggleRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/automation-rules/${id}/toggle`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['rules'] }),
  });
}
