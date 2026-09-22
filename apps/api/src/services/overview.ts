import { coverageLevel, plannedCoverage, type CoverageTask } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';

export interface CoverageRow {
  clientId: string;
  name: string;
  color: string;
  video: number | null;
  graphic: number | null;
  days: number;
  level: 'ok' | 'warn' | 'danger';
}

/** Директорски преглед (PRD §4.9, Handoff §7): покриеност по клиент + работа по статус. */
export async function getOverview() {
  const clients = await prisma.client.findMany({ where: { status: 'aktiven', archivedAt: null } });
  const today = new Date();

  const coverage: CoverageRow[] = [];
  for (const c of clients) {
    const tasks = await prisma.task.findMany({
      where: { clientId: c.id },
      include: { slot: { select: { date: true } } },
    });
    const line = (type: 'video' | 'graphic'): CoverageTask[] =>
      tasks
        .filter((t) => t.contentType === type)
        .map((t) => ({ status: t.status, publishDate: t.slot?.date ?? null }));

    const video = c.videosPerMonth > 0 ? plannedCoverage(line('video'), today) : null;
    const graphic = c.graphicsPerMonth > 0 ? plannedCoverage(line('graphic'), today) : null;
    const nums = [video, graphic].filter((x): x is number => x !== null);
    const days = nums.length ? Math.min(...nums) : 0;
    coverage.push({
      clientId: c.id,
      name: c.name,
      color: c.color,
      video,
      graphic,
      days,
      level: coverageLevel(days),
    });
  }
  coverage.sort((a, b) => a.days - b.days); // најкритичните најгоре

  const grouped = await prisma.task.groupBy({ by: ['status'], _count: { _all: true } });
  const byStatus = grouped.map((g) => ({ status: g.status, count: g._count._all }));

  // alarms/campaigns доаѓаат во B1/B2.
  return { coverage, byStatus, alarms: [], campaigns: [] };
}
