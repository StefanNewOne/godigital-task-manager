import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import {
  approveMonthForAllStandard,
  getMonthProposal,
  isMonthApprovedForClient,
} from '../services/monthlyCalendar.js';
import { createVideoCapa } from '../services/workflow/groupTransition.js';
import { cleanupMonth } from './helpers.js';

/**
 * Редизајн: месечно одобрување на календар (групирано по комбинација) + тврд гејт за нова капа.
 */
const db = new PrismaClient();
const MONTH = '2033-05';
const ids: string[] = [];
const stdConfigIds: string[] = [];

async function mkClient(name: string, v: number, g: number): Promise<string> {
  const c = await db.client.create({
    data: {
      name,
      color: '#334155',
      contractStart: new Date(Date.UTC(2033, 0, 1)),
      contractMonths: 12,
      videosPerMonth: v,
      graphicsPerMonth: g,
      calendarType: 'standarden',
    },
  });
  ids.push(c.id);
  return c.id;
}

beforeAll(async () => {
  // Стандарден календар: видео вторник, графика пон/сре/пет.
  for (const [ct, wd] of [
    ['video', [2]],
    ['graphic', [1, 3, 5]],
  ] as const) {
    const cfg = await db.calendarConfig.create({
      data: { clientId: null, contentType: ct, weekdays: [...wd], publishTime: '10:00' },
    });
    stdConfigIds.push(cfg.id);
  }
  await mkClient('ТЕСТ МК A', 4, 12);
  await mkClient('ТЕСТ МК B', 4, 12); // иста комбинација како A
  await mkClient('ТЕСТ МК C', 2, 8); // друга комбинација
});

afterAll(async () => {
  await cleanupMonth(db, MONTH); // чисти генерирани слотови/капи за сите клиенти за месецот
  await db.publishingSlot.deleteMany({ where: { clientId: { in: ids } } });
  await db.client.deleteMany({ where: { id: { in: ids } } });
  await db.calendarConfig.deleteMany({ where: { id: { in: stdConfigIds } } });
  await db.$disconnect();
});

describe('Месечно одобрување (редизајн)', () => {
  it('предлог е групиран по комбинација со датуми, неодобрен на почеток', async () => {
    const p = await getMonthProposal(MONTH);
    expect(p.hasStandard).toBe(true);
    const mine = p.combinations.filter((c) => c.clients.some((cl) => ids.includes(cl.id)));
    // две комбинации: (2,8) и (4,12)
    const combo412 = mine.find((c) => c.videos === 4 && c.graphics === 12);
    expect(combo412).toBeTruthy();
    const cids = combo412!.clients.map((c) => c.id);
    expect(cids).toContain(ids[0]); // A
    expect(cids).toContain(ids[1]); // B
    expect(combo412!.videoDates.length).toBeGreaterThan(0);
    expect(combo412!.graphicDates.length).toBeGreaterThan(0);
    expect(combo412!.approved).toBe(false);
  });

  it('тврд гејт: нова капа во неодобрен месец → MONTH_NOT_APPROVED + аларм до АМ', async () => {
    await expect(
      createVideoCapa({ clientId: ids[0]!, month: MONTH }, { id: 'x', role: 'rez' }),
    ).rejects.toMatchObject({ code: 'MONTH_NOT_APPROVED' });
    const am = await db.employee.findFirst({ where: { role: 'am' } });
    const note = await db.notification.findFirst({
      where: { recipientId: am!.id, eventKey: 'month_not_approved', clientId: ids[0]! },
    });
    expect(note).not.toBeNull();
  });

  it('одобрување создава reserved слотови + капа за сите стандардни клиенти', async () => {
    const r = await approveMonthForAllStandard(MONTH, { id: 'am1', role: 'am' });
    expect(r.approvedClients).toBeGreaterThanOrEqual(3);

    for (const id of ids) {
      expect(await isMonthApprovedForClient(id, MONTH)).toBe(true);
      const reserved = await db.publishingSlot.count({
        where: { clientId: id, monthKey: MONTH, status: 'reserved' },
      });
      expect(reserved).toBeGreaterThan(0);
      const groups = await db.taskGroup.count({ where: { clientId: id, monthKey: MONTH } });
      expect(groups).toBeGreaterThan(0);
    }
    const p = await getMonthProposal(MONTH);
    const combo412 = p.combinations.find((c) => c.videos === 4 && c.graphics === 12);
    expect(combo412!.approved).toBe(true);
  });
});
