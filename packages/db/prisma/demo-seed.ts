/**
 * ДЕМО податоци — ги полни клиентите и Септември 2026 како во прототипот, за визуелен преглед.
 * ПРИВРЕМЕНО (ќе се исчисти): ова НЕ е дел од каноничкиот seed. Идемпотентно за MONTH.
 *   pnpm db:demo   (бара DATABASE_URL)
 */
import { PrismaClient, type ContentType, type Priority, type TaskStatus } from '../src/index.js';

const prisma = new PrismaClient();
const MONTH = '2026-09';
const YEAR = 2026;
const M0 = 8; // септември (0-базиран)

// Клиенти како во прототипот (додади ги што недостасуваат).
const CLIENTS = [
  { name: 'Ресторан ИВ', color: '#0D9488', video: 4, graphic: 8, meta: true },
  { name: 'Дарма Дома', color: '#DB2777', video: 3, graphic: 6, meta: true },
  { name: 'Астибо', color: '#7C3AED', video: 4, graphic: 6, meta: true },
  { name: 'Алекс Дизајн', color: '#0EA5E9', video: 2, graphic: 8, meta: true },
  { name: 'ЛЛ Гурмет', color: '#D97706', video: 3, graphic: 6, meta: true },
  { name: 'Голд Хотел', color: '#65A30D', video: 2, graphic: 4, meta: false },
];

// Задачи по прототипот: [клиент, тип, наслов, статус, улога-на-доделен|null, ден, верзија, итно?]
type Spec = [string, ContentType, string, TaskStatus, string | null, number, number, boolean];
const TASKS: Spec[] = [
  ['Ресторан ИВ', 'graphic', 'Ресторан ИВ G-9-9-агенда', 'objaveno', 'am', 17, 1, false],
  ['Ресторан ИВ', 'graphic', 'Ресторан ИВ G-9-10-агенда', 'zaObjavuvanje', 'am', 21, 2, false],
  ['Ресторан ИВ', 'video', 'Ресторан ИВ V-9-3', 'vnatresno', 'rez', 22, 2, true],
  ['Ресторан ИВ', 'graphic', 'Ресторан ИВ G-9-11-агенда', 'dizajn', 'diz', 23, 1, false],
  ['Ресторан ИВ', 'video', 'Ресторан ИВ V-9-4', 'montaza', 'mon', 25, 2, false],
  ['Ресторан ИВ', 'graphic', 'Ресторан ИВ G-9-12-агенда', 'brifing', 'krea', 26, 1, false],

  ['Дарма Дома', 'video', 'Дарма Дома V-9-2', 'zaObjavuvanje', 'am', 18, 1, true],
  ['Дарма Дома', 'graphic', 'Дарма Дома G-9-11', 'kajKlient', 'krea', 21, 1, false],
  ['Дарма Дома', 'graphic', 'Дарма Дома G-9-12', 'dizajn', 'diz', 24, 3, false],
  ['Дарма Дома', 'graphic', 'Дарма Дома G-9-13', 'mrtov', null, 28, 1, false],

  ['Астибо', 'video', 'Астибо V-9-5', 'analitika', 'ana', 15, 2, false],
  ['Астибо', 'graphic', 'Астибо пост 7', 'vnatresno', 'krea', 21, 2, false],
  ['Астибо', 'video', 'Астибо V-9-4', 'chekaRezija', 'rez', 22, 1, false],
  ['Астибо', 'graphic', 'Астибо пост 8', 'dizajn', 'diz', 23, 1, false],

  ['Алекс Дизајн', 'graphic', 'Алекс Дизајн G-9-4', 'kajKlient', 'krea', 19, 1, false],
  ['Алекс Дизајн', 'graphic', 'Алекс Дизајн G-9-5', 'brifing', 'krea', 24, 1, false],
];

// Видео капа таскови што се прикажуваат како капа-картички (активна претпродукција).
// [клиент, статус-на-група, сценарист?, датум-снимање?, локација?]
const CAPAS: Array<
  [string, TaskStatus extends never ? never : string, boolean, number | null, string | null]
> = [
  ['Астибо', 'snimanje', true, 27, 'Скопје, студио'],
  ['ЛЛ Гурмет', 'scenKajKlient', true, null, null],
  ['Ресторан ИВ', 'scenarija', true, null, null],
];

async function main() {
  const emps = await prisma.employee.findMany();
  const byRole: Record<string, string> = {};
  for (const e of emps) byRole[e.role] = e.id;
  const scenId = byRole.scen;

  // 1) Клиенти
  const clientId: Record<string, string> = {};
  for (const c of CLIENTS) {
    let cl = await prisma.client.findFirst({ where: { name: c.name } });
    if (!cl) {
      cl = await prisma.client.create({
        data: {
          name: c.name,
          color: c.color,
          contractStart: new Date('2026-01-01'),
          contractMonths: 12,
          videosPerMonth: c.video,
          graphicsPerMonth: c.graphic,
          usesMetaAds: c.meta,
          approvalChannel: 'viber',
          calendarType: 'standarden',
          status: 'aktiven',
          coverageAlarmDays: 7,
        },
      });
    }
    clientId[c.name] = cl.id;
  }

  // 2) Исчисти постоечки MONTH податоци за демо клиентите (идемпотентно)
  const demoClientIds = Object.values(clientId);
  const oldTasks = await prisma.task.findMany({
    where: { clientId: { in: demoClientIds }, group: { monthKey: MONTH } },
    select: { id: true },
  });
  const oldIds = oldTasks.map((t) => t.id);
  if (oldIds.length) {
    await prisma.publication.deleteMany({ where: { taskId: { in: oldIds } } });
    await prisma.revision.deleteMany({ where: { taskId: { in: oldIds } } });
    await prisma.comment.deleteMany({ where: { taskId: { in: oldIds } } });
    await prisma.task.deleteMany({ where: { id: { in: oldIds } } });
  }
  await prisma.publishingSlot.deleteMany({
    where: { clientId: { in: demoClientIds }, monthKey: MONTH },
  });
  await prisma.taskGroup.deleteMany({
    where: { clientId: { in: demoClientIds }, monthKey: MONTH },
  });

  // 3) Групи по клиент+тип (една видео + една графика). Видео статус = капа-стадиум ако е активна.
  const capaStage = new Map(CAPAS.map((c) => [c[0], c]));
  const groupId = new Map<string, string>(); // key `${client}:${type}`
  for (const c of CLIENTS) {
    for (const type of ['graphic', 'video'] as ContentType[]) {
      const capa = type === 'video' ? capaStage.get(c.name) : undefined;
      const status = (capa ? capa[1] : type === 'video' ? 'zatvoren' : 'zatvoren') as never;
      const g = await prisma.taskGroup.create({
        data: {
          clientId: clientId[c.name]!,
          contentType: type,
          monthKey: MONTH,
          status,
          plannedCount: type === 'video' ? c.video : c.graphic,
          scenaristId: capa && capa[2] ? scenId : null,
          shootDate: capa && capa[3] ? new Date(Date.UTC(YEAR, M0, capa[3])) : null,
          shootLocation: capa ? (capa[4] ?? null) : null,
        },
      });
      groupId.set(`${c.name}:${type}`, g.id);
    }
  }

  // 4) Задачи + слотови
  const orderByKey = new Map<string, number>(); // (client,type,day) → orderInDay
  for (const [client, type, title, status, role, day, version, urgent] of TASKS) {
    const cid = clientId[client]!;
    const okey = `${client}:${type}:${day}`;
    const order = (orderByKey.get(okey) ?? 0) + 1;
    orderByKey.set(okey, order);
    const date = new Date(Date.UTC(YEAR, M0, day));
    const reserved = status === 'mrtov';
    const slot = await prisma.publishingSlot.create({
      data: {
        clientId: cid,
        contentType: type,
        monthKey: MONTH,
        date,
        orderInDay: order,
        status: reserved ? 'reserved' : 'used',
      },
    });
    await prisma.task.create({
      data: {
        groupId: groupId.get(`${client}:${type}`)!,
        clientId: cid,
        contentType: type,
        title,
        status: status as never,
        assigneeId: role ? (byRole[role] ?? null) : null,
        priority: (urgent ? 'iten' : 'normalen') as Priority,
        version,
        slotId: slot.id,
        copy: status === 'objaveno' || status === 'zaObjavuvanje' ? 'Демо копи текст.' : null,
        statusChangedAt: new Date(Date.UTC(YEAR, M0, Math.max(1, day - 2))),
      },
    });
  }

  const total = await prisma.task.count({
    where: { clientId: { in: demoClientIds }, group: { monthKey: MONTH } },
  });
  console.log(
    `демо готово: ${CLIENTS.length} клиенти, ${total} таска, ${CAPAS.length} активни капи за ${MONTH}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
