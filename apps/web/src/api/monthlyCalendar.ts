import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export interface ComboProposal {
  videos: number;
  graphics: number;
  clients: Array<{ id: string; name: string }>;
  videoDates: string[];
  graphicDates: string[];
  approved: boolean;
}
export interface MonthProposal {
  month: string;
  hasStandard: boolean;
  videoWeekdays: number[];
  graphicWeekdays: number[];
  combinations: ComboProposal[];
}

export function useMonthProposal(month: string, enabled: boolean) {
  return useQuery({
    queryKey: ['month-proposal', month],
    queryFn: () => api.get<MonthProposal>(`/calendar/month-proposal?month=${month}`),
    enabled,
  });
}

export function useApproveMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      month: string;
      edits?: Record<string, { videoDates: string[]; graphicDates: string[] }>;
    }) =>
      api.post<{ month: string; approvedClients: number; skipped: number; combinations: number }>(
        '/calendar/approve-month',
        input,
      ),
    onSuccess: (_r, v) => {
      void qc.invalidateQueries({ queryKey: ['month-proposal', v.month] });
      void qc.invalidateQueries({ queryKey: ['slots'] });
    },
  });
}
