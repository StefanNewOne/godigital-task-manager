import webpush from 'web-push';
import { env } from '../env.js';
import { prisma } from '../db/tenantExtension.js';

/**
 * Web Push (Фаза C5). Без VAPID клучеви → тивко no-op (dev/тест stub, како другите адаптери).
 */
let configured = false;
function ensureConfigured(): boolean {
  if (configured) return true;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return false;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  configured = true;
  return true;
}

/** Јавниот VAPID клуч (frontend го зема за да се претплати). null ако push не е конфигуриран. */
export function pushPublicKey(): string | null {
  return env.VAPID_PUBLIC_KEY ?? null;
}

export interface PushSubInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function subscribePush(employeeId: string, sub: PushSubInput): Promise<void> {
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    create: { employeeId, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
    update: { employeeId, p256dh: sub.keys.p256dh, auth: sub.keys.auth },
  });
}

export async function unsubscribePush(endpoint: string): Promise<void> {
  await prisma.pushSubscription.deleteMany({ where: { endpoint } });
}

export interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

/** Best-effort push до сите уреди на примачот. Мртви претплати (404/410) се бришат. */
export async function sendPushToEmployee(employeeId: string, payload: PushPayload): Promise<void> {
  if (!ensureConfigured()) return;
  const subs = await prisma.pushSubscription.findMany({ where: { employeeId } });
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        );
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await prisma.pushSubscription.deleteMany({ where: { endpoint: s.endpoint } });
        }
      }
    }),
  );
}
