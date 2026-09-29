import { prisma } from '../../db/tenantExtension.js';
import { env } from '../../env.js';
import { getMetaClient } from './metaClient.js';

/**
 * Модул 3 · Мета — MF3: „Поврзувања" (§8). Токен-картички + табела конекции по клиент.
 * §12: НИКОГАШ не враќа вредност на токен — само име, статус, scopes и истек (од debug_token).
 */

interface TokenCard {
  name: string;
  configured: boolean;
  valid: boolean;
  expiresAt: string | null;
  scopes: string[];
}

async function tokenCard(name: string, token: string | undefined): Promise<TokenCard> {
  if (!token) return { name, configured: false, valid: false, expiresAt: null, scopes: [] };
  try {
    const d = await getMetaClient().debugToken(token);
    return { name, configured: true, valid: d.isValid, expiresAt: d.expiresAt, scopes: d.scopes };
  } catch {
    return { name, configured: true, valid: false, expiresAt: null, scopes: [] };
  }
}

/** Токен-статус + конекции по клиент. Само dir/am (рутата гати). */
export async function metaConnections() {
  const tokens = await Promise.all([
    tokenCard('GoAds Monitor', env.META_SYSTEM_TOKEN),
    tokenCard('GoInbox Monitor', env.META_INBOX_TOKEN),
  ]);

  const conns = await prisma.metaConnection.findMany({ orderBy: [{ clientId: 'asc' }] });
  const clientIds = [...new Set(conns.map((c) => c.clientId))];
  const clients = await prisma.client.findMany({
    where: { id: { in: clientIds } },
    select: { id: true, name: true, color: true },
  });
  const clientById = new Map(clients.map((c) => [c.id, c]));

  // Групирај по клиент → еден ред со сите видови конекции.
  const byClient = new Map<
    string,
    {
      clientId: string;
      name: string;
      color: string;
      adAccount: string | null;
      currency: string | null;
      accessLevel: string | null;
      page: string | null;
      ig: string | null;
      igMessages: boolean | null;
    }
  >();
  for (const c of conns) {
    let row = byClient.get(c.clientId);
    if (!row) {
      const cl = clientById.get(c.clientId);
      row = {
        clientId: c.clientId,
        name: cl?.name ?? '—',
        color: cl?.color ?? '#C4CBD4',
        adAccount: null,
        currency: null,
        accessLevel: null,
        page: null,
        ig: null,
        igMessages: null,
      };
      byClient.set(c.clientId, row);
    }
    if (c.kind === 'adAccount') {
      row.adAccount = c.metaId;
      row.currency = c.currency;
      row.accessLevel = c.accessLevel;
    } else if (c.kind === 'page') {
      row.page = c.metaId;
    } else if (c.kind === 'igAccount') {
      row.ig = c.metaId;
      row.igMessages = c.igMessagesEnabled;
    }
  }

  return { tokens, rows: [...byClient.values()] };
}
