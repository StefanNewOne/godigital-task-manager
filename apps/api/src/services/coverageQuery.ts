import { plannedCoverage, type CoverageTask } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';

export interface ClientCoverage {
  clientId: string;
  name: string;
  /** Планирана покриеност во денови (најлоша линија); +∞ ако клиентот нема квота. */
  days: number;
  /** Прагот на клиентот за аларм (`coverageAlarmDays`). */
  threshold: number;
}

/**
 * Планирана покриеност по активен клиент (PRD §4.9): најлошата (min) линија меѓу видео и
 * графика, само за типовите со квота > 0. Единствен извор за аларм-от и дневниот преглед —
 * доменската пресметка е `plannedCoverage` во `@gd/core`; тука е само DB собирот.
 */
export async function clientCoverageDays(today: Date): Promise<ClientCoverage[]> {
  const clients = await prisma.client.findMany({ where: { status: 'aktiven', archivedAt: null } });
  const out: ClientCoverage[] = [];
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
    out.push({ clientId: c.id, name: c.name, days, threshold: c.coverageAlarmDays });
  }
  return out;
}
