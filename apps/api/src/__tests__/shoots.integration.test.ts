import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { transitionTaskGroup } from '../services/workflow/groupTransition.js';
import { addShootSession, listShootCalendar } from '../services/shoots.js';

/**
 * Редизајн: термини на снимање. Основен се создава при podgotovka→scenarija; Камерман додава
 * дополнителни во snimanje; „Календар на снимање" ги прикажува сите.
 */
const db = new PrismaClient();
const MONTH = '2034-04';
let clientId = '';
let groupId = '';
let rezId = '';
let scenId = '';
let kamId = '';

beforeAll(async () => {
  const client = await db.client.create({
    data: {
      name: 'ТЕСТ Снимања',
      color: '#111827',
      contractStart: new Date(Date.UTC(2034, 0, 1)),
      contractMonths: 12,
      videosPerMonth: 2,
    },
  });
  clientId = client.id;
  rezId = (await db.employee.findFirst({ where: { role: 'rez' } }))!.id;
  scenId = (await db.employee.findFirst({ where: { role: 'scen' } }))!.id;
  kamId = (await db.employee.findFirst({ where: { role: 'kam' } }))!.id;
  const g = await db.taskGroup.create({
    data: {
      clientId,
      contentType: 'video',
      monthKey: MONTH,
      status: 'podgotovka',
      plannedCount: 2,
      rezId,
    },
  });
  groupId = g.id;
});

afterAll(async () => {
  await db.shootSession.deleteMany({ where: { groupId } });
  await db.task.deleteMany({ where: { clientId } });
  await db.scenario.deleteMany({ where: { group: { clientId } } });
  await db.taskGroup.deleteMany({ where: { clientId } });
  await db.client.delete({ where: { id: clientId } });
  await db.$disconnect();
});

describe('Термини на снимање (редизајн)', () => {
  it('podgotovka→scenarija создава основен термин на снимање', async () => {
    await transitionTaskGroup(
      groupId,
      'scenarija',
      {
        scenaristId: scenId,
        shootDate: new Date(Date.UTC(2034, 3, 10, 9, 0)),
        shootLocation: 'Скопје — студио',
        scenaristNotes: 'Насоки.',
      },
      { id: rezId, role: 'rez' },
    );
    const shoots = await db.shootSession.findMany({ where: { groupId } });
    expect(shoots).toHaveLength(1);
    expect(shoots[0]!.kind).toBe('primary');
    expect(shoots[0]!.location).toBe('Скопје — студио');
  });

  it('Камерман додава дополнителен термин во snimanje', async () => {
    await db.taskGroup.update({ where: { id: groupId }, data: { status: 'snimanje' } });
    await addShootSession(
      groupId,
      { date: new Date(Date.UTC(2034, 3, 12, 11, 0)), location: 'Скопје — екстериер' },
      { id: kamId, role: 'kam' },
    );
    const shoots = await db.shootSession.findMany({ where: { groupId }, orderBy: { date: 'asc' } });
    expect(shoots).toHaveLength(2);
    expect(shoots[1]!.kind).toBe('additional');
  });

  it('„Календар на снимање" ги прикажува термините со клиент/локација', async () => {
    const items = await listShootCalendar(MONTH);
    const mine = items.filter((i) => i.groupId === groupId);
    expect(mine.length).toBe(2);
    expect(mine.every((i) => i.clientName === 'ТЕСТ Снимања')).toBe(true);
    expect(mine.some((i) => i.location.includes('екстериер'))).toBe(true);
  });

  it('дополнително снимање надвор од snimanje → одбива', async () => {
    await db.taskGroup.update({ where: { id: groupId }, data: { status: 'zatvoren' } });
    await expect(
      addShootSession(groupId, { date: new Date(), location: 'x' }, { id: kamId, role: 'kam' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
  });
});
