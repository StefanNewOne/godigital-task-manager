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
  const groups = await db.taskGroup.findMany({ where: { monthKey }, select: { id: true } });
  const gids = groups.map((g) => g.id);
  if (gids.length) {
    const scens = await db.scenario.findMany({
      where: { groupId: { in: gids } },
      select: { id: true },
    });
    const sids = scens.map((s) => s.id);
    if (sids.length) {
      await db.approval.deleteMany({ where: { objectType: 'scenario', objectId: { in: sids } } });
      await db.scenario.deleteMany({ where: { id: { in: sids } } });
    }
  }
  await db.publishingSlot.deleteMany({ where: { monthKey } });
  await db.taskGroup.deleteMany({ where: { monthKey } });
}
