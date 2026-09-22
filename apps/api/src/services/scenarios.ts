import {
  ROLE_LABEL,
  type Role,
  type ScenarioOutcomesInput,
  type ScenarioSplitInput,
  type ScenarioUpdateInput,
} from '@gd/core';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { recordEvent } from '../lib/events.js';

/**
 * Сценарија на видео капа (A4, PRD §4.3). Го отклучуваат текот
 * scenarija → scenKajKlient → snimanje: поделба на документот на N сценарија,
 * потоа исход по сценарио од клиентот. Scenario НЕ е append-only — при повторна
 * поделба се заменуваат за тековната верзија на документот.
 */

const SPLIT_ROLES: Role[] = ['scen', 'rez', 'dir'];
const OUTCOME_ROLES: Role[] = ['rez', 'am', 'dir'];

/** Подели го сценарискиот документ на N сценарија (status=predlozeno). */
export async function splitScenarios(
  groupId: string,
  input: ScenarioSplitInput,
  actor: { id: string; role: Role },
) {
  const group = await prisma.taskGroup.findUnique({
    where: { id: groupId },
    include: { client: true },
  });
  if (!group) throw new AppError('NOT_FOUND', 'Капа таскот не е пронајден.', 404);
  if (group.contentType !== 'video') {
    throw new AppError('VALIDATION_FAILED', 'Сценарија постојат само за видео капа.', 400);
  }
  if (group.status !== 'scenarija') {
    throw new AppError('VALIDATION_FAILED', 'Поделба е дозволена само во статус „Сценарија".', 400);
  }
  if (!SPLIT_ROLES.includes(actor.role)) {
    throw new AppError('FORBIDDEN_ROLE', 'Немате дозвола да делите сценарија.', 403);
  }

  return prisma.$transaction(async (tx) => {
    await tx.scenario.deleteMany({
      where: { groupId, docVersion: group.scenarioDocVersion },
    });
    for (let i = 0; i < input.scenarios.length; i++) {
      const s = input.scenarios[i]!;
      await tx.scenario.create({
        data: {
          groupId,
          ordinal: i + 1,
          docVersion: group.scenarioDocVersion,
          title: s.title,
          hook: s.hook,
          body: s.body,
          notes: s.notes,
          status: 'predlozeno',
          source: 'manual',
        },
      });
    }
    await recordEvent(tx, {
      eventType: 'scenarios.split',
      objectType: 'group',
      objectId: group.id,
      groupId: group.id,
      clientId: group.clientId,
      newValue: { count: input.scenarios.length },
      narrative: `${ROLE_LABEL[actor.role]} подели ${input.scenarios.length} сценарија за „${group.client.name} · ${group.monthKey}".`,
    });
    return tx.scenario.findMany({ where: { groupId }, orderBy: { ordinal: 'asc' } });
  });
}

/** Постави исход по сценарио од клиентот (odobreno / odobrenoSoIzmeni / otfrleno). */
export async function setScenarioOutcomes(
  groupId: string,
  input: ScenarioOutcomesInput,
  actor: { id: string; role: Role },
) {
  const group = await prisma.taskGroup.findUnique({
    where: { id: groupId },
    include: { client: true },
  });
  if (!group) throw new AppError('NOT_FOUND', 'Капа таскот не е пронајден.', 404);
  if (group.contentType !== 'video') {
    throw new AppError('VALIDATION_FAILED', 'Сценарија постојат само за видео капа.', 400);
  }
  if (group.status !== 'scenKajKlient') {
    throw new AppError(
      'VALIDATION_FAILED',
      'Исходи се внесуваат само во статус „Сценарија кај клиент".',
      400,
    );
  }
  if (!OUTCOME_ROLES.includes(actor.role)) {
    throw new AppError('FORBIDDEN_ROLE', 'Немате дозвола да внесувате исходи.', 403);
  }

  return prisma.$transaction(async (tx) => {
    for (const item of input.items) {
      const scenario = await tx.scenario.findUnique({ where: { id: item.scenarioId } });
      if (!scenario || scenario.groupId !== groupId) {
        throw new AppError('NOT_FOUND', 'Сценариото не припаѓа на оваа капа.', 404);
      }
      await tx.scenario.update({
        where: { id: item.scenarioId },
        data: { status: item.status, clientComment: item.clientComment },
      });
    }
    await recordEvent(tx, {
      eventType: 'scenarios.outcomes',
      objectType: 'group',
      objectId: group.id,
      groupId: group.id,
      clientId: group.clientId,
      newValue: { outcomes: input.items.length },
      narrative: `${ROLE_LABEL[actor.role]} внесе исходи за ${input.items.length} сценарија („${group.client.name} · ${group.monthKey}").`,
    });
    return tx.scenario.findMany({ where: { groupId }, orderBy: { ordinal: 'asc' } });
  });
}

/** Уреди поле на сценарио (наслов/hook/тело/белешки). */
export async function updateScenario(
  scenarioId: string,
  patch: ScenarioUpdateInput,
  actor: { id: string; role: Role },
) {
  if (!SPLIT_ROLES.includes(actor.role)) {
    throw new AppError('FORBIDDEN_ROLE', 'Немате дозвола да уредувате сценарија.', 403);
  }
  const scenario = await prisma.scenario.findUnique({
    where: { id: scenarioId },
    include: { group: true },
  });
  if (!scenario) throw new AppError('NOT_FOUND', 'Сценариото не е пронајдено.', 404);

  return prisma.$transaction(async (tx) => {
    const updated = await tx.scenario.update({ where: { id: scenarioId }, data: patch });
    await recordEvent(tx, {
      eventType: 'scenario.updated',
      objectType: 'scenario',
      objectId: scenarioId,
      groupId: scenario.groupId,
      clientId: scenario.group.clientId,
      narrative: `${ROLE_LABEL[actor.role]} го уреди сценариото „${updated.title}".`,
    });
    return updated;
  });
}
