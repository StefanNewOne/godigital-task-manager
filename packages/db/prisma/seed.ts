/**
 * Seed (PRD §4.14) — идемпотентен. 9 вработени + 6 клиенти (илустративно, од прототипот),
 * стандарден календар, празници, StatusDeadlineConfig default, модули, 15 системски правила.
 * Dev лозинка за сите: `gd-devpass-2026`.
 */
import bcrypt from 'bcryptjs';
import { DEFAULT_GROUP_LEAD_DAYS, DEFAULT_TASK_LEAD_DAYS } from '@gd/core';
import { prisma, type Role, type ContentType, type ModuleKind } from '../src/index.js';

const DEV_PASSWORD = 'gd-devpass-2026';

const EMPLOYEES: Array<{
  name: string;
  email: string;
  role: Role;
  color: string;
  isScenaristToo?: boolean;
}> = [
  { name: 'Алекс К.', email: 'aleks@godigital.mk', role: 'dir', color: '#0866FF' },
  { name: 'Тамара С.', email: 'tamara@godigital.mk', role: 'am', color: '#DB2777' },
  {
    name: 'Стефан Б.',
    email: 'stefan@godigital.mk',
    role: 'rez',
    color: '#7C3AED',
    isScenaristToo: true,
  },
  { name: 'Илија Н.', email: 'ilija@godigital.mk', role: 'scen', color: '#0284C7' },
  { name: 'Никола П.', email: 'nikola@godigital.mk', role: 'kam', color: '#0D9488' },
  { name: 'Дејан Т.', email: 'dejan@godigital.mk', role: 'mon', color: '#D97706' },
  { name: 'Љубица М.', email: 'ljubica@godigital.mk', role: 'krea', color: '#0EA5E9' },
  { name: 'Драган В.', email: 'dragan@godigital.mk', role: 'diz', color: '#65A30D' },
  { name: 'Ване Ѓ.', email: 'vane@godigital.mk', role: 'ana', color: '#DC2626' },
];

const CLIENTS: Array<{
  name: string;
  color: string;
  videosPerMonth: number;
  graphicsPerMonth: number;
  usesMetaAds: boolean;
  approvalChannel: 'viber' | 'whatsapp' | 'email';
  calendarType: 'standarden' | 'specificen';
  modules: ModuleKind[];
}> = [
  {
    name: 'Ресторан ИВ',
    color: '#0D9488',
    videosPerMonth: 4,
    graphicsPerMonth: 8,
    usesMetaAds: true,
    approvalChannel: 'viber',
    calendarType: 'standarden',
    modules: ['goScripterAi', 'claudeAssistant'],
  },
  {
    name: 'Алекс Дизајн',
    color: '#DB2777',
    videosPerMonth: 2,
    graphicsPerMonth: 8,
    usesMetaAds: true,
    approvalChannel: 'email',
    calendarType: 'standarden',
    modules: ['graficarAi'],
  },
  {
    name: 'Астибо',
    color: '#7C3AED',
    videosPerMonth: 4,
    graphicsPerMonth: 6,
    usesMetaAds: true,
    approvalChannel: 'viber',
    calendarType: 'standarden',
    modules: ['goScripterAi', 'aiCopywriter'],
  },
  {
    name: 'Филтер Вода',
    color: '#0EA5E9',
    videosPerMonth: 2,
    graphicsPerMonth: 4,
    usesMetaAds: false,
    approvalChannel: 'whatsapp',
    calendarType: 'standarden',
    modules: [],
  },
  {
    name: 'ГоМаркет',
    color: '#D97706',
    videosPerMonth: 3,
    graphicsPerMonth: 10,
    usesMetaAds: true,
    approvalChannel: 'viber',
    calendarType: 'standarden',
    modules: ['graficarAi', 'aiCopywriter', 'claudeAssistant'],
  },
  {
    name: 'Студио Тон',
    color: '#65A30D',
    videosPerMonth: 1,
    graphicsPerMonth: 6,
    usesMetaAds: false,
    approvalChannel: 'email',
    calendarType: 'specificen',
    modules: [],
  },
];

// 15 системски настани (PRD §13) → системски AutomationRule (isSystem).
const SYSTEM_RULES = [
  'Потсетник: 15 дена пред видео датум',
  'Потсетник: 7 дена пред датум',
  'Аларм: 2 дена пред датум',
  'Аларм: 24ч по снимање без суров материјал',
  'Аларм: застој во статус > 3 дена',
  'Критичен: покриеност под 7 дена',
  'Потсетник: рок за овој статус наближува',
  'Аларм: враќање од клиент (3-ти пат)',
  'Аларм: одобрени сценарија ≠ резервирани слотови',
  'Аларм: објава без копи/линк на денот',
  'Критичен: пропуштен резервиран слот',
  'Технички: истечен Meta токен',
  'Технички: неуспешно влечење метрики',
  'Технички: недозволен преод обиден',
  'Технички: сторидж квота 80%',
];

async function main() {
  const passwordHash = await bcrypt.hash(DEV_PASSWORD, 10);

  // Вработени — upsert по email.
  for (const e of EMPLOYEES) {
    await prisma.employee.upsert({
      where: { email: e.email },
      update: {
        name: e.name,
        role: e.role,
        color: e.color,
        isScenaristToo: e.isScenaristToo ?? false,
      },
      create: {
        name: e.name,
        email: e.email,
        passwordHash,
        role: e.role,
        color: e.color,
        isScenaristToo: e.isScenaristToo ?? false,
      },
    });
  }
  const director = await prisma.employee.findUnique({ where: { email: 'aleks@godigital.mk' } });

  // Клиенти — findFirst по име, па create (идемпотентно по име).
  for (const c of CLIENTS) {
    let client = await prisma.client.findFirst({ where: { name: c.name } });
    if (!client) {
      client = await prisma.client.create({
        data: {
          name: c.name,
          color: c.color,
          contractStart: new Date('2026-01-01'),
          contractMonths: 12,
          videosPerMonth: c.videosPerMonth,
          graphicsPerMonth: c.graphicsPerMonth,
          usesMetaAds: c.usesMetaAds,
          approvalChannel: c.approvalChannel,
          calendarType: c.calendarType,
        },
      });
    }

    // Календари (стандарден: видео вт/пет, графика пон/сре/чет).
    for (const [contentType, weekdays] of [
      ['video', [2, 5]],
      ['graphic', [1, 3, 4]],
    ] as Array<[ContentType, number[]]>) {
      await prisma.calendarConfig.upsert({
        where: { clientId_contentType: { clientId: client.id, contentType } },
        update: { weekdays, publishTime: '12:00' },
        create: {
          clientId: client.id,
          contentType,
          weekdays,
          publishTime: '12:00',
          allowTwoPerDay: false,
        },
      });
    }

    // Модули.
    for (const module of c.modules) {
      await prisma.moduleAssignment.upsert({
        where: { clientId_module: { clientId: client.id, module } },
        update: { active: true },
        create: { clientId: client.id, module, active: true, assignedById: director?.id },
      });
    }
  }

  // Празници (септември 2026).
  for (const h of [
    { date: new Date('2026-09-08'), name: 'Ден на независноста' },
    { date: new Date('2026-09-11'), name: 'Празник' },
  ]) {
    const existing = await prisma.holiday.findFirst({ where: { date: h.date, clientId: null } });
    if (!existing) {
      await prisma.holiday.create({ data: { date: h.date, name: h.name, scope: 'global' } });
    }
  }

  // StatusDeadlineConfig — глобален seed од core (findFirst+create; null clientId не е dedup-абилен во unique).
  const seedDeadline = async (
    target: 'task' | 'group',
    contentType: ContentType,
    status: string,
    leadDays: number,
  ) => {
    const existing = await prisma.statusDeadlineConfig.findFirst({
      where: { scope: 'global', clientId: null, target, contentType, status },
    });
    if (existing) {
      await prisma.statusDeadlineConfig.update({ where: { id: existing.id }, data: { leadDays } });
    } else {
      await prisma.statusDeadlineConfig.create({
        data: { scope: 'global', target, contentType, status, leadDays },
      });
    }
  };
  for (const contentType of ['video', 'graphic'] as ContentType[]) {
    for (const [status, leadDays] of Object.entries(DEFAULT_TASK_LEAD_DAYS[contentType])) {
      await seedDeadline('task', contentType, status, leadDays);
    }
  }
  for (const [status, leadDays] of Object.entries(DEFAULT_GROUP_LEAD_DAYS)) {
    await seedDeadline('group', 'video', status, leadDays);
  }

  // 15 системски правила.
  for (const name of SYSTEM_RULES) {
    const existing = await prisma.automationRule.findFirst({ where: { name, isSystem: true } });
    if (!existing) {
      await prisma.automationRule.create({
        data: {
          name,
          scope: 'global',
          trigger: {},
          conditions: [],
          actions: [],
          enabled: true,
          isSystem: true,
          createdById: director?.id,
        },
      });
    }
  }

  console.warn(
    `seed готов: ${EMPLOYEES.length} вработени, ${CLIENTS.length} клиенти, ${SYSTEM_RULES.length} системски правила.`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
