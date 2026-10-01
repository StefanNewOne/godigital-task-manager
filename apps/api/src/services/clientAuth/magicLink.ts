import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '../../db/tenantExtension.js';
import { signClientToken } from '../../lib/auth.js';
import { sendEmail } from '../../lib/mailer.js';
import { env } from '../../env.js';
import { logger } from '../../lib/logger.js';

/**
 * Клиентски magic-link (Фаза D) — огледало на заборавена лозинка (H4). Рутите се UNAUTHENTICATED,
 * па `ClientMagicToken` намерно НЕ е во tenant-extension списокот — `tenantId` се поставува/
 * предикатира експлицитно (И1). Токенот се чува само како sha-256 hash; plaintext оди само во
 * email линкот (§12). Без user-enumeration — генерички однос (§9).
 */
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 часа (magic-link); сесијата потоа е кратка (2ч, JWT)

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Барање magic-link: генерички однос (без enumeration). Ако постои client-contact со `isApprover`
 * и валиден email, ги поништува претходните неискористени токени, создава нов и испраќа линк.
 */
export async function requestMagicLink(email: string): Promise<void> {
  // ClientContact е tenant-scoped во extension → tenantId се инјектира од контекст (DEFAULT_TENANT_ID).
  const contact = await prisma.clientContact.findFirst({
    where: { email, isApprover: true, archivedAt: null },
    select: { id: true, tenantId: true, email: true },
  });
  if (!contact || !contact.email) return; // тивко — не откривај дали контактот постои

  await prisma.clientMagicToken.updateMany({
    where: { clientContactId: contact.id, tenantId: contact.tenantId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = randomBytes(32).toString('hex');
  await prisma.clientMagicToken.create({
    data: {
      tenantId: contact.tenantId,
      clientContactId: contact.id,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    },
  });

  const link = `${env.WEB_ORIGIN}/client?token=${token}`;
  const sent = await sendEmail(
    contact.email,
    'Пристап до одобрувања — GoDigital',
    `Добивте линк за пристап до вашите одобрувања во GoDigital.\n\n` +
      `Отворете го линкот (важи 24 часа):\n${link}\n\n` +
      `Ако не сте го побарале ова, игнорирајте ја пораката.`,
  );
  // Никогаш не логирај токен/линк (§12) — само дека е испратено барање.
  logger.info({ clientContactId: contact.id, sent }, 'client magic link requested');
}

/**
 * Троши magic-link токен (еднократен) и издава кратка клиентска сесија (JWT realm=client).
 * Враќа null ако токенот е невалиден/истечен/искористен.
 */
export async function consumeMagicLink(token: string): Promise<string | null> {
  const row = await prisma.clientMagicToken.findFirst({
    where: {
      tokenHash: sha256(token),
      tenantId: env.DEFAULT_TENANT_ID,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
    include: { contact: { select: { id: true, clientId: true, isApprover: true } } },
  });
  if (!row || !row.contact.isApprover) return null;

  await prisma.clientMagicToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });

  return signClientToken({
    sub: row.contact.id,
    tenantId: row.tenantId,
    clientId: row.contact.clientId,
  });
}
