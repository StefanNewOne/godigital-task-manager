import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

/** Поставки за известувања: вработен може да ги исклучи само потсетниците (§16). */
export function useUpdateNotificationPrefs() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (reminders: boolean) =>
      api.patch<{ reminders: boolean }>('/me/notification-prefs', { reminders }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['me'] }),
  });
}
