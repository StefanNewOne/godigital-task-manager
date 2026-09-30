import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../db/tenantExtension.js';
import { hashPassword } from '../../lib/auth.js';
import { sendEmail } from '../../lib/mailer.js';
import { env } from '../../env.js';
import { logger } from '../../lib/logger.js';

/**
 * Заборавена лозинка (H4). Рутите се UNAUTHENTICATED, па `PasswordResetToken` намерно НЕ е во
 * tenant-extension списокот — `tenantId` се поставува/предикатира експлицитно (И1).
 * Токенот се чува само како sha-256 hash; plaintext оди само во email линкот (§12).
 */
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 час

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Барање ресет: генерички однос (без user-enumeration, §9). Ако корисникот постои и е активен,
 * ги поништува претходните неискористени токени, создава нов и испраќа email со линк.
 */
export async function requestPasswordReset(email: string): Promise<void> {
  const employee = await prisma.employee.findUnique({ where: { email } });
  if (!employee || !employee.active) return; // тивко — не откривај дали сметката постои

  // Поништи претходни неискористени токени за овој корисник.
  await prisma.passwordResetToken.updateMany({
    where: { employeeId: employee.id, tenantId: employee.tenantId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomBytes(32).toString('hex');
  await prisma.passwordResetToken.create({
    data: {
      tenantId: employee.tenantId,
      employeeId: employee.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const link = `${env.WEB_ORIGIN}/reset-password?token=${token}`;
  const sent = await sendEmail(
    employee.email,
    'Ресетирање на лозинка',
    `Побаравте ресетирање на лозинката за GoDigital Таск-менаџер.\n\n` +
      `Отвори го линкот (важи 1 час):\n${link}\n\n` +
      `Ако не сте го побарале ова, игнорирајте ја пораката.`,
  );
  // Никогаш не логирај токен/линк (§12) — само дека е испратено барање.
  logger.info({ employeeId: employee.id, sent }, 'password reset requested');
}

/**
 * Троши токен и поставува нова лозинка. Враќа false ако токенот е невалиден/истечен/искористен.
 */
export async function resetPassword(token: string, newPassword: string): Promise<boolean> {
  const row = await prisma.passwordResetToken.findFirst({
    where: {
      tokenHash: sha256(token),
      tenantId: env.DEFAULT_TENANT_ID,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });
  if (!row) return false;

  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction([
    prisma.employee.update({ where: { id: row.employeeId }, data: { passwordHash } }),
    prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
  ]);
  return true;
}
