import { dedupeKey, notificationChannels, ymd, type NotificationLevel } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';

export interface NotifyInput {
  recipientId: string;
  level: NotificationLevel;
  eventKey: string;
  title: string;
  body: string;
  taskId?: string;
  groupId?: string;
  clientId?: string;
}

/**
 * Создади известување со дедупликација (PRD §4.13). potsetnik може да е исклучен по вработен.
 * Каналите (in-app/email/sms) се резолвираат по ниво (D-12) и се запишуваат во channelsSent;
 * реалното праќање (email/SMS) го прави worker-от во следен чекор.
 */
export async function createNotification(input: NotifyInput) {
  if (input.level === 'potsetnik') {
    const emp = await prisma.employee.findUnique({
      where: { id: input.recipientId },
      select: { notificationPrefs: true },
    });
    const prefs = emp?.notificationPrefs as { reminders?: boolean } | null;
    if (prefs && prefs.reminders === false) return null;
  }

  const scopeId = input.taskId ?? input.groupId ?? input.clientId ?? 'global';
  const key = dedupeKey(input.eventKey, scopeId, input.recipientId, ymd(new Date()));

  return prisma.notification.upsert({
    where: { dedupeKey: key },
    update: {},
    create: {
      recipientId: input.recipientId,
      level: input.level,
      eventKey: input.eventKey,
      taskId: input.taskId ?? null,
      groupId: input.groupId ?? null,
      clientId: input.clientId ?? null,
      title: input.title,
      body: input.body,
      channelsSent: notificationChannels(input.level),
      dedupeKey: key,
    },
  });
}
