import { PrismaClient } from './generated/client/index.js';

/**
 * Единствена Prisma инстанца. Tenant-scope се инјектира на API слојот преку extension
 * (apps/api/src/db/tenantExtension.ts) — CLAUDE.md И1. Никогаш raw query без tenantId.
 */
export const prisma = new PrismaClient();

export * from './generated/client/index.js';
