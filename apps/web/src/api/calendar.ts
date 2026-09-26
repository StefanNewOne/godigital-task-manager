import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export interface CalendarConfigRow {
  id: string;
  clientId: string | null;
  contentType: 'video' | 'graphic';
  weekdays: number[];
  publishTime: string;
  allowTwoPerDay: boolean;
}

export interface CalendarConfigInput {
  contentType: 'video' | 'graphic';
  weekdays: number[];
  publishTime: string;
  allowTwoPerDay: boolean;
}

/** Стандарден календар (clientId=null) — важи за клиенти со calendarType=standarden. */
export function useStandardCalendar() {
  return useQuery({
    queryKey: ['standard-calendar'],
    queryFn: () => api.get<CalendarConfigRow[]>('/calendar/standard'),
  });
}

export function useSaveStandardCalendar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CalendarConfigInput) =>
      api.put<CalendarConfigRow>('/calendar/standard', input),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['standard-calendar'] }),
  });
}
