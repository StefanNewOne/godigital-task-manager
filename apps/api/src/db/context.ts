import { AsyncLocalStorage } from 'node:async_hooks';
import type { Role } from '@gd/core';
import { env } from '../env.js';

/**
 * Per-request контекст (CLAUDE.md И1). `tenantId` доаѓа ИСКЛУЧИВО од JWT claim и се чита
 * од tenant extension-от + recordEvent. Никогаш од body/query/header.
 */
export interface RequestContext {
  tenantId: string;
  actorId?: string;
  actorRole?: Role;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();

export function ctx(): RequestContext {
  return requestContext.getStore() ?? { tenantId: env.DEFAULT_TENANT_ID };
}
