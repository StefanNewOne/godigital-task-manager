import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../env.js';
import { logger } from './logger.js';

/**
 * SMTP испраќач за известувања ниво alarm/kritichen (D-12). Локално = Mailhog (без auth).
 * Best-effort: грешките се логираат, не се фрлаат — известувањето е веќе создадено in-app.
 */
let transporter: Transporter | null = null;

function getTransporter(): Transporter {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: false,
      auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } : undefined,
    });
  }
  return transporter;
}

export async function sendEmail(to: string, subject: string, text: string): Promise<boolean> {
  if (!env.EMAIL_ENABLED || env.NODE_ENV === 'test') return false;
  try {
    await getTransporter().sendMail({ from: env.SMTP_FROM, to, subject, text });
    return true;
  } catch (err) {
    logger.warn({ err, to, subject }, 'email.send.failed');
    return false;
  }
}
