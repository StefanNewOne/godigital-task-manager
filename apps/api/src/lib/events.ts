import type { Prisma, OutboxKind } from '@gd/db';
import type { TxClient } from '../db/tenantExtension.js';
import { ctx } from '../db/context.js';

/**
 * Запиши настан во EventLog + Outbox во ИСТАТА трансакција (CLAUDE.md И2, PRD §4.12).
 * Нема настан без наратив; нема mutation без настан. Outbox drainer (worker) го разнесува
 * за real-time / знаење / известувања — без „dual write".
 */
export interface EventInput {
  eventType: string;
  objectType: string;
  objectId: string;
  narrative: string;
  clientId?: string | null;
  taskId?: string | null;
  groupId?: string | null;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  context?: Prisma.InputJsonValue;
}

export async function recordEvent(
  tx: TxClient,
  input: EventInput,
  kinds: OutboxKind[] = ['realtime', 'knowledge'],
) {
  const { tenantId, actorId, actorRole } = ctx();
  const event = await tx.eventLog.create({
    data: {
      tenantId,
      actorId: actorId ?? null,
      actorRole: actorRole ?? null,
      eventType: input.eventType,
      objectType: input.objectType,
      objectId: input.objectId,
      clientId: input.clientId ?? null,
      taskId: input.taskId ?? null,
      groupId: input.groupId ?? null,
      oldValue: input.oldValue,
      newValue: input.newValue,
      context: input.context,
      narrative: input.narrative,
    },
  });
  for (const kind of kinds) {
    await tx.outbox.create({ data: { eventLogId: event.id, kind } });
  }
  return event;
}
