import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ClientApprovalInput, MagicLinkConsumeInput, MagicLinkRequestInput } from '@gd/core';
import { api } from '../lib/api.js';

/** Клиентски PWA (Фаза D) — одделен realm; сесијата е httpOnly cookie (`client_token`). */

export interface ClientApprovalItem {
  id: string;
  title: string;
  contentType: 'video' | 'graphic';
  version: number;
  status: string;
  publishDate: string | null;
}

export function useRequestMagicLink() {
  return useMutation({
    mutationFn: (input: MagicLinkRequestInput) => api.post('/client/auth/magic-link', input),
  });
}

export function useConsumeMagicLink() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: MagicLinkConsumeInput) =>
      api.post<{ accessToken: string }>('/client/auth/consume', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['client', 'approvals'] });
    },
  });
}

export function useClientLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/client/auth/logout'),
    onSuccess: () => {
      qc.removeQueries({ queryKey: ['client'] });
    },
  });
}

export function useClientApprovals() {
  return useQuery({
    queryKey: ['client', 'approvals'],
    queryFn: () => api.get<ClientApprovalItem[]>('/client/approvals'),
    retry: false,
  });
}

export function useClientApproval(id: string) {
  return useQuery({
    queryKey: ['client', 'approval', id],
    queryFn: () => api.get<ClientApprovalItem>(`/client/approvals/task/${id}`),
    retry: false,
    enabled: !!id,
  });
}

export function useClientDecide(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ClientApprovalInput) =>
      api.post<ClientApprovalItem>(`/client/approvals/task/${id}/decide`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['client', 'approvals'] });
      void qc.invalidateQueries({ queryKey: ['client', 'approval', id] });
    },
  });
}
