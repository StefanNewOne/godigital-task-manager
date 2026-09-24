import { plannedCoverage, type CoverageTask } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';
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
  const clients = await prisma.client.findMany({ where: { status: 'aktiven', archivedAt: null } });
  const today = new Date();
  let created = 0;

  for (const c of clients) {
    const tasks = await prisma.task.findMany({
      where: { clientId: c.id },
      include: { slot: { select: { date: true } } },
    });
    const line = (type: 'video' | 'graphic'): CoverageTask[] =>
      tasks
        .filter((t) => t.contentType === type)
        .map((t) => ({ status: t.status, publishDate: t.slot?.date ?? null }));

    const nums: number[] = [];
    if (c.videosPerMonth > 0) nums.push(plannedCoverage(line('video'), today));
    if (c.graphicsPerMonth > 0) nums.push(plannedCoverage(line('graphic'), today));
    const days = nums.length ? Math.min(...nums) : Number.POSITIVE_INFINITY;

    if (days < c.coverageAlarmDays) {
      for (const d of directors) {
        const n = await createNotification({
          recipientId: d.id,
          level: 'kritichen',
          eventKey: 'coverage_low',
          clientId: c.id,
          title: `Ниска покриеност: ${c.name}`,
          body: `Покриеноста за „${c.name}" е ${days} дена (праг ${c.coverageAlarmDays}).`,
        });
        if (n) created++;
      }
    }
  }
  return { created };
}
