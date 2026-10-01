import { env } from '../env.js';
import { logger } from './logger.js';

/**
 * SMS испраќач за критични аларми (D-12 / O-B1). Provider = Twilio преку raw HTTP (без нова
 * зависност, §18). Без credentials → dev-stub (само лог, враќа false). Best-effort: грешките се
 * логираат, не се фрлаат — известувањето е веќе создадено in-app.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  if (env.NODE_ENV === 'test') return false;
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_FROM) {
    // Нема provider credentials → stub (активација во deployment фаза, O-B1).
    logger.info({ to }, 'sms.stub (no Twilio credentials)');
    return false;
  }
  try {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${env.TWILIO_ACCOUNT_SID}/Messages.json`;
    const auth = Buffer.from(`${env.TWILIO_ACCOUNT_SID}:${env.TWILIO_AUTH_TOKEN}`).toString(
      'base64',
    );
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: to, From: env.TWILIO_FROM, Body: body }).toString(),
    });
    if (!res.ok) {
      logger.warn({ to, status: res.status }, 'sms.send.failed');
      return false;
    }
    return true;
  } catch (err) {
    logger.warn({ err, to }, 'sms.send.failed');
    return false;
  }
}
