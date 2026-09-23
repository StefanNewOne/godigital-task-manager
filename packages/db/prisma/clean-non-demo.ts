/**
 * Еднократно чистење: брише СЕ оперативни податоци надвор од демо-месецот (2026-09) —
 * остатоци од интеграциски тестови и рачно тестирање (2027-xx, Окт/Ное slot-редови).
 * Ги ЗАДРЖУВА базните ентитети (клиенти, вработени, календари, празници, правила, рокови) и
 * целиот 2026-09 демо. Append-only записите (EventLog/Approval/MetricSnapshot) остануваат како
 * ревизиска трага — немаат FK кон Task/TaskGroup па не пречат.
 *   pnpm --filter @gd/db exec tsx prisma/clean-non-demo.ts        (dry-run: само брои)
 *   pnpm --filter @gd/db exec tsx prisma/clean-non-demo.ts --apply (навистина брише)
 */
import { PrismaClient } from '../src/index.js';

const prisma = new PrismaClient();
const KEEP_MONTH = '2026-09';
const APPLY = process.argv.includes('--apply');

async function main() {
  // Целни групи (сите освен демо-месецот) и нивните таскови.
  const groups = await prisma.taskGroup.findMany({
    where: { monthKey: { not: KEEP_MONTH } },
    select: { id: true },
  });
  const groupIds = groups.map((g) => g.id);

  const tasks = await prisma.task.findMany({
    where: { group: { monthKey: { not: KEEP_MONTH } } },
    select: { id: true },
  });
  const taskIds = tasks.map((t) => t.id);

  const counts = {
    publications: await prisma.publication.count({ where: { taskId: { in: taskIds } } }),
    revisions: await prisma.revision.count({ where: { taskId: { in: taskIds } } }),
    comments: await prisma.comment.count({
      where: { OR: [{ taskId: { in: taskIds } }, { groupId: { in: groupIds } }] },
    }),
    tasks: taskIds.length,
    scenarios: await prisma.scenario.count({ where: { groupId: { in: groupIds } } }),
    groups: groupIds.length,
    slots: await prisma.publishingSlot.count({ where: { monthKey: { not: KEEP_MONTH } } }),
  };

  console.log(
    `\n${APPLY ? '🧹 БРИШЕ' : '🔍 DRY-RUN (само брои, ништо не брише)'} — надвор од ${KEEP_MONTH}:`,
  );
  for (const [k, v] of Object.entries(counts)) console.log(`  ${k}: ${v}`);

  if (!APPLY) {
    console.log('\nЗа навистина да избришеш: додади --apply');
    return;
  }

  // FK-безбеден редослед: деца прво, потоа таскови, потоа деца на групи, потоа групи, потоа слотови.
  await prisma.publication.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.revision.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.comment.deleteMany({ where: { taskId: { in: taskIds } } });
  await prisma.task.deleteMany({ where: { id: { in: taskIds } } });
  await prisma.scenario.deleteMany({ where: { groupId: { in: groupIds } } });
  await prisma.comment.deleteMany({ where: { groupId: { in: groupIds } } });
  await prisma.taskGroup.deleteMany({ where: { id: { in: groupIds } } });
  await prisma.publishingSlot.deleteMany({ where: { monthKey: { not: KEEP_MONTH } } });

  const remaining = await prisma.task.count();
  console.log(`\n✅ Готово. Преостанати таскови (само ${KEEP_MONTH}): ${remaining}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
