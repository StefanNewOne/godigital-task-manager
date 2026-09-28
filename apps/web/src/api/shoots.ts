import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

export interface ShootSessionRow {
  id: string;
  groupId: string;
  date: string;
  location: string;
  kind: 'primary' | 'additional';
}

/** Термини на снимање за капата (Капа панел). */
export function useGroupShoots(groupId: string | null) {
  return useQuery({
    queryKey: ['shoots', groupId],
    queryFn: () => api.get<ShootSessionRow[]>(`/task-groups/${groupId}/shoots`),
    enabled: !!groupId,
  });
}

/** Камерман додава дополнителен термин на снимање. */
export function useAddShoot(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { date: string; location: string }) =>
      api.post<ShootSessionRow>(`/task-groups/${groupId}/shoots`, input),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['shoots', groupId] });
      void qc.invalidateQueries({ queryKey: ['shoot-calendar'] });
    },
  });
}

export interface ShootCalendarItem {
  id: string;
  groupId: string;
  date: string;
  location: string;
  kind: string;
  clientName: string;
  clientColor: string;
  monthKey: string;
  status: string;
}

/** Календар на снимање (Режисер/Директор/Камерман). */
export function useShootCalendar(month: string) {
  return useQuery({
    queryKey: ['shoot-calendar', month],
    queryFn: () =>
      api.get<{ month: string; shoots: ShootCalendarItem[] }>(`/shoot-calendar?month=${month}`),
  });
}
