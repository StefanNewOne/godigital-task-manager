/**
 * Известувања — канали по ниво (PRD §4.13, D-12) и dedupeKey. Чиста логика.
 * potsetnik = in-app; alarm = in-app + email; kritichen = in-app + email + SMS (нема Viber).
 */

export type NotificationLevel = 'potsetnik' | 'alarm' | 'kritichen';
export type NotificationChannel = 'system' | 'email' | 'sms' | 'push';

export function notificationChannels(level: NotificationLevel): NotificationChannel[] {
  // Push (Фаза C5) е вклучен на секое ниво — стигнува на телефон и кога апликацијата е затворена.
  if (level === 'kritichen') return ['system', 'email', 'sms', 'push'];
  if (level === 'alarm') return ['system', 'email', 'push'];
  return ['system', 'push'];
}

/** dedupeKey: ист аларм за ист објект не се повторува во истиот ден (PRD §4.13). */
export function dedupeKey(
  eventKey: string,
  scopeId: string,
  recipientId: string,
  day: string,
): string {
  return `${eventKey}:${scopeId}:${recipientId}:${day}`;
}
