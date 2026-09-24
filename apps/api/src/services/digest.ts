import { prisma } from '../db/tenantExtension.js';
import { clientCoverageDays } from './coverageQuery.js';
import { createNotification } from './notifications.js';

/** ICU-лајт плурал за „N задача / N задачи" (мк). */
function tasksWord(n: number): string {
  return n === 1 ? 'задача' : 'задачи';
}

/**
 * Дневен преглед за Директор (PRD §4.13, job `notifications.digest` во 07:00). Роллап на
 * тековната состојба што бара внимание: клиенти под праг на покриеност + задачи што чекаат
 * одобрување од клиент. Праќа се како `alarm` (in-app + email), дедуп по ден. Ако нема што
 * да се пријави — нема празен преглед (се прескокнува).
 */
export async function generateDailyDigest() {
  const directors = await prisma.employee.findMany({ where: { role: 'dir', active: true } });
  if (directors.length === 0) return { created: 0, skipped: 'no-directors' as const };

  const coverage = await clientCoverageDays(new Date());
  const low = coverage.filter((c) => c.days < c.threshold).sort((a, b) => a.days - b.days);
  const awaitingClient = await prisma.task.count({ where: { status: 'kajKlient' } });

  if (low.length === 0 && awaitingClient === 0) return { created: 0, skipped: 'empty' as const };

  const parts: string[] = [];
  if (low.length > 0) {
    const names = low.map((c) => `${c.name} (${c.days} дена)`).join(', ');
    parts.push(`Ниска покриеност (${low.length}): ${names}.`);
  }
  if (awaitingClient > 0) {
    parts.push(`Кај клиент за одобрување: ${awaitingClient} ${tasksWord(awaitingClient)}.`);
  }
  const body = parts.join(' ');

  let created = 0;
  for (const d of directors) {
    const n = await createNotification({
      recipientId: d.id,
      level: 'alarm',
      eventKey: 'daily_digest',
      title: 'Дневен преглед',
      body,
    });
    if (n) created++;
  }
  return { created };
}
