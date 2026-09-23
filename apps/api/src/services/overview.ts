import { coverageLevel, plannedCoverage, plannedUntil, type CoverageTask } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';

export interface CoverageRow {
  clientId: string;
  name: string;
  color: string;
  video: number | null;
  graphic: number | null;
  videoQuota: number;
  graphicQuota: number;
  /** Најдоцен испланиран датум по тип (ISO), за „до {датум}". null ако нема. */
  videoUntil: string | null;
  graphicUntil: string | null;
  days: number;
  level: 'ok' | 'warn' | 'danger';
}

export interface StatusRow {
  status: string;
  count: number;
  /** Просечни денови поминати во тековниот статус. */
  avgDays: number;
}

const MS_PER_DAY = 86_400_000;

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
    const videoUntil =
      c.videosPerMonth > 0 ? (plannedUntil(line('video'))?.toISOString() ?? null) : null;
    const graphicUntil =
      c.graphicsPerMonth > 0 ? (plannedUntil(line('graphic'))?.toISOString() ?? null) : null;
    const nums = [video, graphic].filter((x): x is number => x !== null);
    const days = nums.length ? Math.min(...nums) : 0;
    coverage.push({
      clientId: c.id,
      name: c.name,
      color: c.color,
      video,
      graphic,
      videoQuota: c.videosPerMonth,
      graphicQuota: c.graphicsPerMonth,
      videoUntil,
      graphicUntil,
      days,
      level: coverageLevel(days),
    });
  }
  coverage.sort((a, b) => a.days - b.days); // најкритичните најгоре

  // Работа по статус: број + просечни денови во тековниот статус.
  const statusTasks = await prisma.task.findMany({
    select: { status: true, statusChangedAt: true },
  });
  const agg = new Map<string, { count: number; totalDays: number }>();
  for (const t of statusTasks) {
    const prev = agg.get(t.status) ?? { count: 0, totalDays: 0 };
    const days = Math.max(
      0,
      Math.floor((today.getTime() - t.statusChangedAt.getTime()) / MS_PER_DAY),
    );
    agg.set(t.status, { count: prev.count + 1, totalDays: prev.totalDays + days });
  }
  const byStatus: StatusRow[] = [...agg.entries()].map(([status, a]) => ({
    status,
    count: a.count,
    avgDays: Math.round(a.totalDays / a.count),
  }));

  // alarms/campaigns доаѓаат во B1/B2.
  return { coverage, byStatus, alarms: [], campaigns: [] };
}
