import type { PrismaClient } from '@gd/db';

/** Исчисти цел месец во точен FK редослед (деца пред таскови). За идемпотентни интеграциски тестови. */
export async function cleanupMonth(db: PrismaClient, monthKey: string): Promise<void> {
  const tasks = await db.task.findMany({ where: { group: { monthKey } }, select: { id: true } });
  const ids = tasks.map((t) => t.id);
  if (ids.length) {
    const pubs = await db.publication.findMany({
      where: { taskId: { in: ids } },
      select: { id: true },
    });
    const pubIds = pubs.map((p) => p.id);
    if (pubIds.length) await db.promotion.deleteMany({ where: { publicationId: { in: pubIds } } });
    await db.publication.deleteMany({ where: { taskId: { in: ids } } });
    await db.revision.deleteMany({ where: { taskId: { in: ids } } });
    await db.comment.deleteMany({ where: { taskId: { in: ids } } });
    await db.approval.deleteMany({ where: { objectType: 'task', objectId: { in: ids } } });
    await db.dateChange.deleteMany({ where: { taskId: { in: ids } } });
    await db.task.deleteMany({ where: { id: { in: ids } } });
  }
  await db.publishingSlot.deleteMany({ where: { monthKey } });
  await db.taskGroup.deleteMany({ where: { monthKey } });
}
