import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { PrismaClient } from '../packages/db/src/generated/client/index.js';

/**
 * E2E task-seeding harness. Seed-от на проектот НЕ создава таскови/капи, па длабоките UI e2e
 * (капа bulk, промена на датум, Board) немаа состојба. Овде преку Prisma создаваме детерминистички
 * ентитети во изолиран месец (2030-01) за клиент „Филтер Вода", и ги чистиме во teardown.
 * ID-евата се пишуваат во `.seed-ids.json` (gitignored) за spec-овите да ги прочитаат.
 *
 * Prisma се увезува директно од генерираниот клиент (`prisma generate` секогаш го создава) за да
 * не зависиме од @gd/db dist/src резолуција во Playwright. DATABASE_URL доаѓа од .env.local (CI го
 * запишува) — се вчитува во global-setup пред ова.
 */
const here = dirname(fileURLToPath(import.meta.url));
const IDS_FILE = resolve(here, '.seed-ids.json');

// Два месеци: TaskGroup е уникатен по (клиент, тип, месец), па bulk и work капата се во одделни месеци.
export const E2E_MONTH_BULK = '2030-01';
export const E2E_MONTH_WORK = '2030-02';
export const E2E_MONTHS = [E2E_MONTH_BULK, E2E_MONTH_WORK];
export const E2E_CLIENT = 'Филтер Вода';
export const DATE_TASK_TITLE = 'E2E Промена Датум';

export interface SeedIds {
  clientId: string;
  bulkGroupId: string;
  dateTaskId: string;
  dateTaskTitle: string;
}

let client: PrismaClient | null = null;
function db(): PrismaClient {
  if (!client) client = new PrismaClient();
  return client;
}

export function readSeedIds(): SeedIds {
  return JSON.parse(readFileSync(IDS_FILE, 'utf8')) as SeedIds;
}

/** Вчитај .env.local во process.env (за Prisma DATABASE_URL во Playwright процесот). CI веќе има env. */
export function loadEnvLocal(): void {
  try {
    const raw = readFileSync(resolve(here, '../.env.local'), 'utf8');
    for (const line of raw.split('\n')) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && m[1] && process.env[m[1]] === undefined) {
        process.env[m[1]] = (m[2] ?? '').replace(/^["']|["']$/g, '');
      }
    }
  } catch {
    /* .env.local е опционален — CI поставува process env директно */
  }
}

export async function cleanupE2e(): Promise<void> {
  const prisma = db();
  const c = await prisma.client.findFirst({ where: { name: E2E_CLIENT } });
  if (!c) return;
  const groups = await prisma.taskGroup.findMany({
    where: { clientId: c.id, monthKey: { in: E2E_MONTHS } },
    select: { id: true },
  });
  const gids = groups.map((g) => g.id);
  if (gids.length) {
    const tasks = await prisma.task.findMany({
      where: { groupId: { in: gids } },
      select: { id: true },
    });
    const tids = tasks.map((t) => t.id);
    if (tids.length) {
      await prisma.dateChange.deleteMany({ where: { taskId: { in: tids } } });
      await prisma.approval.deleteMany({ where: { objectType: 'task', objectId: { in: tids } } });
      await prisma.revision.deleteMany({ where: { taskId: { in: tids } } });
      await prisma.task.deleteMany({ where: { id: { in: tids } } });
    }
    await prisma.taskGroup.deleteMany({ where: { id: { in: gids } } });
  }
  await prisma.publishingSlot.deleteMany({
    where: { clientId: c.id, monthKey: { in: E2E_MONTHS } },
  });
}

export async function seedE2e(): Promise<void> {
  const prisma = db();
  const c = await prisma.client.findFirst({ where: { name: E2E_CLIENT } });
  if (!c) throw new Error(`E2E seed: клиент „${E2E_CLIENT}" не постои — прво db:setup (seed).`);

  await cleanupE2e(); // идемпотентно (повторни локални пуштања)

  // (1) Графичка капа во gPodgotovka + 3 мртви деца — за bulk-активација e2e.
  const bulk = await prisma.taskGroup.create({
    data: {
      clientId: c.id,
      contentType: 'graphic',
      monthKey: E2E_MONTH_BULK,
      status: 'gPodgotovka',
      plannedCount: 3,
    },
  });
  for (let i = 0; i < 3; i++) {
    const slot = await prisma.publishingSlot.create({
      data: {
        clientId: c.id,
        contentType: 'graphic',
        date: new Date(Date.UTC(2030, 0, 5 + i)),
        orderInDay: 1,
        status: 'reserved',
        monthKey: E2E_MONTH_BULK,
      },
    });
    await prisma.task.create({
      data: {
        groupId: bulk.id,
        clientId: c.id,
        contentType: 'graphic',
        title: `E2E булк ${i + 1}`,
        status: 'mrtov',
        slotId: slot.id,
      },
    });
  }

  // (2) Активен графички таск (brifing) со слот — за промена на датум + Board e2e.
  const work = await prisma.taskGroup.create({
    data: {
      clientId: c.id,
      contentType: 'graphic',
      monthKey: E2E_MONTH_WORK,
      status: 'zatvoren',
      plannedCount: 1,
    },
  });
  const dateSlot = await prisma.publishingSlot.create({
    data: {
      clientId: c.id,
      contentType: 'graphic',
      date: new Date(Date.UTC(2030, 1, 10)),
      orderInDay: 1,
      status: 'reserved',
      monthKey: E2E_MONTH_WORK,
    },
  });
  const dateTask = await prisma.task.create({
    data: {
      groupId: work.id,
      clientId: c.id,
      contentType: 'graphic',
      title: DATE_TASK_TITLE,
      status: 'brifing',
      slotId: dateSlot.id,
      titleIsAuto: false,
    },
  });

  const ids: SeedIds = {
    clientId: c.id,
    bulkGroupId: bulk.id,
    dateTaskId: dateTask.id,
    dateTaskTitle: DATE_TASK_TITLE,
  };
  writeFileSync(IDS_FILE, JSON.stringify(ids, null, 2) + '\n', 'utf8');
}

export async function disconnectE2e(): Promise<void> {
  if (client) await client.$disconnect();
}
