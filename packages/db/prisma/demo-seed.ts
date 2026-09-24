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
// [клиент, статус-на-група, сценарист?, датум-снимање?, локација?, одобрени-сценарија (од 4)]
const CAPAS: Array<[string, string, boolean, number | null, string | null, number]> = [
  ['Астибо', 'snimanje', true, 27, 'Скопје, студио', 4],
  ['ЛЛ Гурмет', 'scenKajKlient', true, null, null, 3],
  ['Ресторан ИВ', 'scenarija', true, null, null, 0],
];

// Објавени постови со метрики (извор за екранот Аналитика §9).
// [клиент, тип, наслов, ден, платформа, тип-пост, платено?, досег, импресии, прегледи, ангажман, ctr%]
type Platform = 'ig' | 'fb' | 'tiktok';
type Post = 'reel' | 'post' | 'story' | 'carousel';
const PUBLISHED: Array<
  [
    string,
    ContentType,
    string,
    number,
    Platform,
    Post,
    boolean,
    number,
    number,
    number,
    number,
    number,
  ]
> = [
  [
    'Ресторан ИВ',
    'video',
    'Ресторан ИВ V-9-1',
    3,
    'ig',
    'reel',
    true,
    42000,
    78000,
    31000,
    3800,
    1.9,
  ],
  [
    'Ресторан ИВ',
    'graphic',
    'Ресторан ИВ G-9-2',
    5,
    'ig',
    'carousel',
    false,
    12000,
    18000,
    0,
    1400,
    1.2,
  ],
  [
    'Дарма Дома',
    'video',
    'Дарма Дома V-9-1',
    4,
    'ig',
    'reel',
    true,
    55000,
    96000,
    40000,
    5200,
    2.1,
  ],
  ['Астибо', 'graphic', 'Астибо G-9-1', 6, 'fb', 'post', false, 9000, 15000, 0, 900, 0.8],
  ['Астибо', 'video', 'Астибо V-9-2', 8, 'ig', 'reel', false, 21000, 33000, 15000, 2100, 1.5],
  [
    'Алекс Дизајн',
    'graphic',
    'Алекс Дизајн G-9-1',
    7,
    'ig',
    'post',
    true,
    17000,
    29000,
    0,
    1900,
    1.6,
  ],
  [
    'ЛЛ Гурмет',
    'video',
    'ЛЛ Гурмет V-9-1',
    9,
    'tiktok',
    'reel',
    false,
    33000,
    51000,
    27000,
    4100,
    2.4,
  ],
  [
    'Голд Хотел',
    'graphic',
    'Голд Хотел G-9-1',
    10,
    'ig',
    'carousel',
    false,
    7000,
    11000,
    0,
    650,
    0.9,
  ],
];

// Кампањи (платени промоции). [клиент, име, буџет, потрошено, cpr, досег, наслов-на-платена-објава]
const CAMPAIGNS: Array<[string, string, number, number, number, number, string]> = [
  ['Ресторан ИВ', 'Есенско мени', 600, 480, 0.0126, 90000, 'Ресторан ИВ V-9-1'],
  ['Дарма Дома', 'Бренд подигање', 500, 420, 0.0105, 78000, 'Дарма Дома V-9-1'],
  ['Алекс Дизајн', 'Промо недела', 300, 240, 0.0141, 34000, 'Алекс Дизајн G-9-1'],
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
    // Календарска конфигурација (за ден-тип совет): видео вт/пет, графика пон/сре/чет.
    for (const [contentType, weekdays] of [
      ['video', [2, 5]],
      ['graphic', [1, 3, 4]],
    ] as Array<['video' | 'graphic', number[]]>) {
      await prisma.calendarConfig.upsert({
        where: { clientId_contentType: { clientId: cl.id, contentType } },
        update: { weekdays },
        create: { clientId: cl.id, contentType, weekdays, publishTime: '12:00' },
      });
    }
  }

  // 2) Исчисти постоечки MONTH податоци за демо клиентите (идемпотентно)
  const demoClientIds = Object.values(clientId);
  const oldTasks = await prisma.task.findMany({
    where: { clientId: { in: demoClientIds }, group: { monthKey: MONTH } },
    select: { id: true },
  });
  const oldIds = oldTasks.map((t) => t.id);
  if (oldIds.length) {
    const oldPubs = await prisma.publication.findMany({
      where: { taskId: { in: oldIds } },
      select: { id: true },
    });
    const oldPubIds = oldPubs.map((p) => p.id);
    if (oldPubIds.length) {
      await prisma.metricSnapshot.deleteMany({ where: { publicationId: { in: oldPubIds } } });
      await prisma.promotion.deleteMany({ where: { publicationId: { in: oldPubIds } } });
    }
    await prisma.publication.deleteMany({ where: { taskId: { in: oldIds } } });
    await prisma.revision.deleteMany({ where: { taskId: { in: oldIds } } });
    await prisma.comment.deleteMany({ where: { taskId: { in: oldIds } } });
    await prisma.task.deleteMany({ where: { id: { in: oldIds } } });
  }
  // Демо кампањи за месецот (+ нивните метрики/промоции).
  const oldCamps = await prisma.campaign.findMany({
    where: {
      clientId: { in: demoClientIds },
      periodFrom: { gte: new Date(Date.UTC(YEAR, M0, 1)), lt: new Date(Date.UTC(YEAR, M0 + 1, 1)) },
    },
    select: { id: true },
  });
  if (oldCamps.length) {
    const campIds = oldCamps.map((c) => c.id);
    await prisma.metricSnapshot.deleteMany({ where: { campaignId: { in: campIds } } });
    await prisma.promotion.deleteMany({ where: { campaignId: { in: campIds } } });
    await prisma.campaign.deleteMany({ where: { id: { in: campIds } } });
  }
  await prisma.publishingSlot.deleteMany({
    where: { clientId: { in: demoClientIds }, monthKey: MONTH },
  });
  const oldGroups = await prisma.taskGroup.findMany({
    where: { clientId: { in: demoClientIds }, monthKey: MONTH },
    select: { id: true },
  });
  if (oldGroups.length) {
    await prisma.scenario.deleteMany({ where: { groupId: { in: oldGroups.map((g) => g.id) } } });
  }
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
          // „кај {име}" = сопственикот на тековниот капа-статус (scen/rez/kam).
          scenaristId: capa ? scenId : null,
          rezId: capa ? byRole.rez : null,
          kamId: capa ? byRole.kam : null,
          shootDate: capa && capa[3] ? new Date(Date.UTC(YEAR, M0, capa[3])) : null,
          shootLocation: capa ? (capa[4] ?? null) : null,
        },
      });
      groupId.set(`${c.name}:${type}`, g.id);
    }
  }

  // 3b) Сценарија за активните видео капи (за „N од 4 сценарија одобрени").
  for (const [client, , , , , approved] of CAPAS) {
    const gid = groupId.get(`${client}:video`);
    if (!gid) continue;
    for (let i = 0; i < 4; i++) {
      await prisma.scenario.create({
        data: {
          groupId: gid,
          ordinal: i + 1,
          title: `Сценарио ${i + 1}`,
          status: i < approved ? 'odobreno' : 'predlozeno',
        },
      });
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

  // 5) Објавени постови + публикации + метрики (извор за Аналитика).
  const pubIdByTitle = new Map<string, string>();
  for (const [
    client,
    type,
    title,
    day,
    platform,
    postType,
    ,
    reach,
    impressions,
    views,
    engagement,
    ctr,
  ] of PUBLISHED) {
    const cid = clientId[client]!;
    const okey = `${client}:${type}:${day}`;
    const order = (orderByKey.get(okey) ?? 0) + 1;
    orderByKey.set(okey, order);
    const date = new Date(Date.UTC(YEAR, M0, day));
    const slot = await prisma.publishingSlot.create({
      data: {
        clientId: cid,
        contentType: type,
        monthKey: MONTH,
        date,
        orderInDay: order,
        status: 'used',
      },
    });
    const task = await prisma.task.create({
      data: {
        groupId: groupId.get(`${client}:${type}`)!,
        clientId: cid,
        contentType: type,
        title,
        status: 'objaveno' as never,
        priority: 'normalen' as Priority,
        version: 1,
        slotId: slot.id,
        copy: 'Демо копи текст.',
        statusChangedAt: date,
      },
    });
    const pub = await prisma.publication.create({
      data: {
        taskId: task.id,
        platform,
        postType,
        publishedAt: date,
        permalink: `https://instagram.com/p/demo-${type}-${day}`,
        resolveStatus: 'resolved',
      },
    });
    pubIdByTitle.set(title, pub.id);
    await prisma.metricSnapshot.create({
      data: {
        publicationId: pub.id,
        capturedAt: date,
        raw: {},
        reach,
        impressions,
        views,
        engagement,
        ctr,
      },
    });
  }

  // 6) Кампањи + метрики + платени промоции.
  for (const [client, name, budget, spend, cpr, reach, pubTitle] of CAMPAIGNS) {
    const camp = await prisma.campaign.create({
      data: {
        clientId: clientId[client]!,
        name,
        objective: 'reach',
        budget,
        periodFrom: new Date(Date.UTC(YEAR, M0, 1)),
        periodTo: new Date(Date.UTC(YEAR, M0, 30)),
        status: 'active',
        analystId: byRole.ana ?? null,
      },
    });
    await prisma.metricSnapshot.create({
      data: {
        campaignId: camp.id,
        capturedAt: new Date(Date.UTC(YEAR, M0, 28)),
        raw: {},
        spend,
        cpr,
        reach,
      },
    });
    const pid = pubIdByTitle.get(pubTitle);
    if (pid) {
      await prisma.promotion.create({
        data: {
          publicationId: pid,
          decision: 'paid',
          campaignId: camp.id,
          decidedById: byRole.ana ?? null,
        },
      });
    }
  }

  const total = await prisma.task.count({
    where: { clientId: { in: demoClientIds }, group: { monthKey: MONTH } },
  });
  console.log(
    `демо готово: ${CLIENTS.length} клиенти, ${total} таска, ${CAPAS.length} активни капи, ` +
      `${PUBLISHED.length} објави + ${CAMPAIGNS.length} кампањи за ${MONTH}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
