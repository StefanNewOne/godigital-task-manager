import { dedupeKey, notificationChannels, ymd, type NotificationLevel } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';
import { sendEmail } from '../lib/mailer.js';
import { sendPushToEmployee } from './push.js';

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

  // Дали е нов запис (за да не праќаме email повторно на дедуплиран аларм истиот ден).
  const existing = await prisma.notification.findUnique({
    where: { dedupeKey: key },
    select: { id: true },
  });

  const notif = await prisma.notification.upsert({
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

  // Само за нов запис, best-effort (не го блокира тек).
  if (!existing) {
    const channels = notificationChannels(input.level);
    if (channels.includes('email')) {
      const emp = await prisma.employee.findUnique({
        where: { id: input.recipientId },
        select: { email: true },
      });
      if (emp?.email) void sendEmail(emp.email, input.title, input.body);
    }
    if (channels.includes('push')) {
      const url = input.taskId
        ? `/tasks?task=${input.taskId}`
        : input.groupId
          ? `/tasks?capa=${input.groupId}`
          : '/';
      void sendPushToEmployee(input.recipientId, { title: input.title, body: input.body, url });
    }
  }

  return notif;
}
