import { prisma } from '../db/tenantExtension.js';
import { clientCoverageDays } from './coverageQuery.js';
import { createNotification } from './notifications.js';

/** Име на системското правило што го контролира овој аларм (Админ → Аларми toggle). */
const COVERAGE_RULE_NAME = 'Критичен: покриеност под 7 дена';

/**
 * Алармот за покриеност (PRD §4.13 правило 6): за секој активен клиент под прагот
 * `coverageAlarmDays`, критично известување до Директор(и). Деде дупликат за истиот ден.
 * Го почитува toggle-от во Админ → Аларми: ако правилото е исклучено, не се евалуира.
 */
export async function evaluateCoverageAlarms() {
  const rule = await prisma.automationRule.findFirst({
    where: { name: COVERAGE_RULE_NAME, isSystem: true },
    select: { enabled: true },
  });
  if (rule && !rule.enabled) return { created: 0, skipped: 'disabled' as const };

  const directors = await prisma.employee.findMany({ where: { role: 'dir', active: true } });
  const coverage = await clientCoverageDays(new Date());
  let created = 0;

  for (const c of coverage) {
    if (c.days < c.threshold) {
      for (const d of directors) {
        const n = await createNotification({
          recipientId: d.id,
          level: 'kritichen',
          eventKey: 'coverage_low',
          clientId: c.clientId,
          title: `Ниска покриеност: ${c.name}`,
          body: `Покриеноста за „${c.name}" е ${c.days} дена (праг ${c.threshold}).`,
        });
        if (n) created++;
      }
    }
  }
  return { created };
}
