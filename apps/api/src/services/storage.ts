import { prisma } from '../db/tenantExtension.js';
import { env } from '../env.js';
import { deleteObject } from '../lib/storage.js';
import { createNotification } from './notifications.js';

const BYTES_PER_GB = 1024 ** 3;

/**
 * Cleanup на суров материјал (B3, PRD §4): групи чиј `rawDeleteAt` е поминат и што НЕ се
 * локално архивирани → избриши ги raw `FileAsset`-ите од R2 + означи `lifecycle=deleted`.
 * Ова е НАМЕРНА retention политика (не ги допира append-only табелите §И6). Best-effort по објект.
 */
export async function runStorageCleanup() {
  const now = new Date();
  const groups = await prisma.taskGroup.findMany({
    where: { rawDeleteAt: { lte: now }, localArchivePath: null },
    select: { id: true },
  });
  let assetsDeleted = 0;
  for (const g of groups) {
    const raws = await prisma.fileAsset.findMany({
      where: { ownerType: 'group', ownerId: g.id, kind: 'raw', lifecycle: 'active' },
      select: { id: true, r2Key: true },
    });
    for (const a of raws) {
      try {
        await deleteObject(a.r2Key);
      } catch {
        // R2 недостапен — DB сепак означува; се пробува повторно следен циклус ако остане active.
      }
      await prisma.fileAsset.update({ where: { id: a.id }, data: { lifecycle: 'deleted' } });
      assetsDeleted++;
    }
    // Исчисти го тајмерот за да не се реобработува.
    await prisma.taskGroup.update({ where: { id: g.id }, data: { rawDeleteAt: null } });
  }
  return { groupsProcessed: groups.length, assetsDeleted };
}

/** Продолжи го животот на суровиот материјал за +30 дена (H7). Од сегашниот рок или од денес. */
export async function extendRaw(groupId: string) {
  const g = await prisma.taskGroup.findUnique({
    where: { id: groupId },
    select: { rawDeleteAt: true },
  });
  if (!g) return null;
  const now = new Date();
  const base = g.rawDeleteAt && g.rawDeleteAt > now ? g.rawDeleteAt : now;
  const next = new Date(base);
  next.setUTCDate(next.getUTCDate() + 30);
  return prisma.taskGroup.update({ where: { id: groupId }, data: { rawDeleteAt: next } });
}

/**
 * Означи дека суровиот материјал е симнат во локална архива (H7): raw асетите одат во
 * `archivedLocally` (не се бришат од сторидж), тајмерот се гаси.
 */
export async function archiveLocally(groupId: string, path: string) {
  const g = await prisma.taskGroup.findUnique({ where: { id: groupId }, select: { id: true } });
  if (!g) return null;
  await prisma.fileAsset.updateMany({
    where: { ownerType: 'group', ownerId: groupId, kind: 'raw', lifecycle: 'active' },
    data: { lifecycle: 'archivedLocally' },
  });
  return prisma.taskGroup.update({
    where: { id: groupId },
    data: { localArchivePath: path, rawDeleteAt: null },
  });
}

/**
 * Квота аларм (B3): вкупен активен сторидж наспроти `STORAGE_QUOTA_GB`. Над прагот → критично
 * известување до Директор(ите), дедуп по ден. (Денес tenant-вкупно — по клиент е идно.)
 */
export async function evaluateStorageQuota() {
  const agg = await prisma.fileAsset.aggregate({
    _sum: { size: true },
    where: { lifecycle: 'active' },
  });
  const bytes = agg._sum.size ?? BigInt(0);
  const usedGb = Math.round((Number(bytes) / BYTES_PER_GB) * 10) / 10;
  const quotaBytes = BigInt(Math.round(env.STORAGE_QUOTA_GB * BYTES_PER_GB));
  if (bytes <= quotaBytes) return { created: 0, usedGb };

  const directors = await prisma.employee.findMany({ where: { role: 'dir', active: true } });
  let created = 0;
  for (const d of directors) {
    const n = await createNotification({
      recipientId: d.id,
      level: 'kritichen',
      eventKey: 'storage_quota',
      title: 'Сторидж квота надмината',
      body: `Искористени ${usedGb} GB од ${env.STORAGE_QUOTA_GB} GB — потребно е чистење или локална архива.`,
    });
    if (n) created++;
  }
  return { created, usedGb };
}
