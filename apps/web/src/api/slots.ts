import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import type { SlotRow } from '../lib/types.js';

export interface CalendarConfigRow {
  contentType: 'video' | 'graphic';
  weekdays: number[]; // 1=пон … 7=нед
}
/** Календарска конфигурација по клиент (кои денови се видео/графика). */
export function useCalendarConfig(clientId: string | null) {
  return useQuery({
    queryKey: ['calendar-config', clientId],
    queryFn: () => api.get<CalendarConfigRow[]>(`/clients/${clientId}/calendar-config`),
    enabled: !!clientId,
  });
}

export interface HolidayRow {
  id: string;
  date: string;
  name: string;
  scope: string;
  clientId: string | null;
}
export function useHolidays() {
  return useQuery({ queryKey: ['holidays'], queryFn: () => api.get<HolidayRow[]>('/holidays') });
}

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
