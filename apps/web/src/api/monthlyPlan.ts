import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export interface MonthlyPlanClientRow {
  clientId: string;
  name: string;
  color: string;
  active: boolean;
}
export interface MonthlyPlanView {
  monthKey: string;
  confirmed: boolean;
  confirmedAt: string | null;
  clients: MonthlyPlanClientRow[];
}

export function useMonthlyPlan(month: string) {
  return useQuery({
    queryKey: ['monthly-plan', month],
    queryFn: () => api.get<MonthlyPlanView>(`/monthly-plan/${month}`),
    staleTime: 30_000,
  });
}

export function usePutMonthlyPlan(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (clients: Array<{ clientId: string; active: boolean }>) =>
      api.put<MonthlyPlanView>(`/monthly-plan/${month}`, { clients }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['monthly-plan', month] }),
  });
}

export function useConfirmMonthlyPlan(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<MonthlyPlanView>(`/monthly-plan/${month}/confirm`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['monthly-plan', month] }),
  });
}

export function useGenerateMonth(month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ clients: number }>(`/monthly-plan/${month}/generate`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['slots'] }),
  });
}
