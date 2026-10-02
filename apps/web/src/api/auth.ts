import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput, ForgotPasswordInput, ResetPasswordInput } from '@gd/core';
import { api } from '../lib/api.js';
import { clearPersistedCache } from '../lib/pwa.js';
import type { Me } from '../lib/types.js';

export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<Me>('/me'),
    retry: false,
    staleTime: 5 * 60 * 1000,
  });
}

export function useLogin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: LoginInput) =>
      api.post<{ accessToken: string; employee: Me }>('/auth/login', input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['me'] });
    },
  });
}

export function useLogout() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post('/auth/logout'),
    onSuccess: async () => {
      qc.clear();
      // Исчисти го и персистираниот PWA кеш — инаку reload го врива стариот `me` и корисникот
      // изгледа сè уште најавен. Потоа чист redirect до login (QA наод #2).
      await clearPersistedCache();
      if (typeof window !== 'undefined') window.location.assign('/');
    },
  });
}

// Заборавена лозинка (H4).
export function useForgotPassword() {
  return useMutation({
    mutationFn: (input: ForgotPasswordInput) => api.post('/auth/forgot-password', input),
  });
}

export function useResetPassword() {
  return useMutation({
    mutationFn: (input: ResetPasswordInput) => api.post('/auth/reset-password', input),
  });
}
