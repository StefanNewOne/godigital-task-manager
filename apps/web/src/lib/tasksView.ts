import { formatDeadlineLabel, taskDeadline, type ContentType, type TaskStatus } from '@gd/core';
import type { TaskListItem } from './types.js';

/** Цели денови од денес до датумот (UTC), или null ако нема датум. */
export function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const d = new Date(iso);
  const now = new Date();
  const a = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const b = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((a - b) / 86_400_000);
}

/** DD.MM.YYYY (Europe/Skopje прикажување на рабовите). */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

/** Релативен датум до 7 дена, инаку апсолутен (Handoff). */
export function relDate(iso: string | null | undefined): string {
  const d = daysUntil(iso);
  if (d === null) return '—';
  if (d === 0) return 'денес';
  if (d === 1) return 'утре';
  if (d === -1) return 'вчера';
  if (d > 1 && d <= 7) return `за ${d} дена`;
  if (d < -1 && d >= -7) return `пред ${Math.abs(d)} дена`;
  return fmtDate(iso);
}

export type UrgencyBucket = 'overdue' | 'todayTomorrow' | 'soon' | 'later' | 'inProgress';

const IN_PROGRESS = new Set(['objaveno', 'zavrseno', 'analitika', 'otkazano', 'pauza']);

/** Секција по итност за „Мои задачи" (Handoff §2.1). */
export function bucketOf(t: TaskListItem): UrgencyBucket {
  if (IN_PROGRESS.has(t.status)) return 'inProgress';
  const d = daysUntil(t.slot?.date);
  if (d === null) return 'inProgress';
  if (d < 0) return 'overdue';
  if (d <= 1) return 'todayTomorrow';
  if (d <= 7) return 'soon';
  return 'later';
}

/** Денови поминати во тековниот статус (за „◷ N дена во статус"). */
export function daysInStatus(t: TaskListItem): number {
  const d = daysUntil(t.statusChangedAt);
  return d === null ? 0 : Math.abs(d);
}

/** Рок за тековниот статус со боја/тежина/префикс (@gd/core). */
export function deadlineFor(t: TaskListItem) {
  if (!t.slot?.date) return null;
  const dl = taskDeadline(
    t.status as TaskStatus,
    t.contentType as ContentType,
    new Date(t.slot.date),
  );
  if (!dl) return null;
  return formatDeadlineLabel(dl, new Date());
}
