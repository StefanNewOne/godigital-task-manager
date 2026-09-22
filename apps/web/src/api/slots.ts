import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import type { SlotRow } from '../lib/types.js';

export function useSlots(clientId: string | null, month: string) {
  return useQuery({
    queryKey: ['slots', clientId, month],
    queryFn: () => api.get<SlotRow[]>(`/clients/${clientId}/slots?month=${month}`),
    enabled: !!clientId,
  });
}

export function useGenerateSlots(clientId: string, month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<SlotRow[]>(`/clients/${clientId}/slots/generate`, { month }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slots', clientId, month] }),
  });
}

export function useConfirmMonth(clientId: string, month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.post(`/clients/${clientId}/slots/confirm`, { month }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slots', clientId, month] }),
  });
}

export function usePatchSlot(clientId: string, month: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { id: string; date: string; orderInDay?: number }) =>
      api.patch<SlotRow>(`/slots/${input.id}`, { date: input.date, orderInDay: input.orderInDay }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['slots', clientId, month] }),
  });
}
