import { PrismaClient } from '@gd/db';
import { ctx } from './context.js';

/**
 * Tenant-scope Prisma extension (CLAUDE.md И1). Инјектира `tenantId` од контекстот:
 *   - create/createMany/upsert → на `data`
 *   - findMany/findFirst/count/aggregate/groupBy/updateMany/deleteMany → на `where`
 *
 * findUnique/update/delete (unique-where по id) НЕ се пресретнуваат: id е глобално уникатен uuid,
 * а денес системот е еден тенант. TODO(TD-4, backlog): при активација на мулти-тенант, овие мора
 * да добијат tenant-guard (findFirst-замена или post-fetch проверка).
 */

// Сите модели со tenantId (Outbox НЕ носи tenantId → се прескокнува).
const TENANT_MODELS = new Set<string>([
  'Client',
  'ClientContact',
  'Employee',
  'CalendarConfig',
  'Holiday',
  'PublishingSlot',
  'TaskGroup',
  'Task',
  'Scenario',
  'Revision',
  'Approval',
  'Comment',
  'Publication',
  'Campaign',
  'Promotion',
  'MetricSnapshot',
  'FileAsset',
  'UploadSession',
  'DateChange',
  'StatusDeadlineConfig',
  'AutomationRule',
  'AutomationRun',
  'ModuleAssignment',
  'Notification',
  'SavedView',
  'EventLog',
  'KnowledgeChunk',
]);

const WHERE_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'count',
  'aggregate',
  'groupBy',
  'updateMany',
  'deleteMany',
]);

export function createPrisma() {
  const base = new PrismaClient();
  return base.$extends({
    query: {
      $allModels: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        async $allOperations({ model, operation, args, query }: any) {
          if (!model || !TENANT_MODELS.has(model)) return query(args);
          const { tenantId } = ctx();
          const a = (args ?? {}) as Record<string, unknown>;

          if (WHERE_OPS.has(operation)) {
            a.where = { ...((a.where as object) ?? {}), tenantId };
          } else if (operation === 'create') {
            a.data = { ...((a.data as object) ?? {}), tenantId };
          } else if (operation === 'createMany') {
            const data = a.data;
            a.data = Array.isArray(data)
              ? data.map((d) => ({ ...(d as object), tenantId }))
              : { ...((data as object) ?? {}), tenantId };
          } else if (operation === 'upsert') {
            a.create = { ...((a.create as object) ?? {}), tenantId };
          }
          return query(a);
        },
      },
    },
  });
}

export type ExtendedPrisma = ReturnType<typeof createPrisma>;

/** Тип на интерактивниот transaction client од extended prisma (за recordEvent и сервиси). */
export type TxClient = Omit<
  ExtendedPrisma,
  '$connect' | '$disconnect' | '$on' | '$use' | '$transaction' | '$extends'
>;

export const prisma = createPrisma();
