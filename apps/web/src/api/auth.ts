import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { LoginInput } from '@gd/core';
import { api } from '../lib/api.js';
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
    onSuccess: () => {
      qc.clear();
    },
  });
}
