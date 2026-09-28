import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import {
  backfillClientCampaigns,
  backfillClientMedia,
  backfillClientPage,
  pullMetrics,
} from '../services/meta/metrics.js';
import { getClientAnalytics } from '../services/clientAnalytics.js';
import { setMetaClient } from '../services/meta/metaClient.js';
import { StubMetaClient } from '../services/meta/metaClient.stub.js';

/**
 * Редизајн Аналитика: по клиент + период, поделено Instagram · Facebook · Реклами со хиерархија
 * кампања→adset→ад. Со детерминистички stub Meta клиент.
 */
const db = new PrismaClient();
let clientId = '';

function thisMonth(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

beforeAll(async () => {
  setMetaClient(new StubMetaClient());
  const c = await db.client.create({
    data: {
      name: 'ТЕСТ Аналитика',
      color: '#2563EB',
      contractStart: new Date(Date.UTC(2026, 0, 1)),
      contractMonths: 12,
      metaIgId: 'stub_ig_an',
      metaPageId: 'stub_page_an',
      metaAdAccountId: 'act_stub_an',
    },
  });
  clientId = c.id;
  await backfillClientMedia(clientId, 3); // stub IG во 2035-06
  await backfillClientCampaigns(clientId, 5);
  await backfillClientPage(clientId); // page snapshot во тековниот месец
  await pullMetrics({ mediaOnly: true });
});

afterAll(async () => {
  await db.publication.deleteMany({ where: { clientId } });
  await db.campaign.deleteMany({ where: { clientId } });
  await db.pageSnapshot.deleteMany({ where: { clientId } });
  await db.client.delete({ where: { id: clientId } });
  setMetaClient(null);
  await db.$disconnect();
});

describe('getClientAnalytics (редизајн)', () => {
  it('Instagram + Реклами со хиерархија кампања→adset→ад (период 2035-06)', async () => {
    const a = await getClientAnalytics(clientId, '2035-06', '2035-06');
    // Instagram
    expect(a.instagram.connected).toBe(true);
    expect(a.instagram.totals.posts).toBeGreaterThan(0);
    expect(a.instagram.byKind.length).toBe(2); // video + image
    // Реклами: дрво со деца (adset) и внуци (ад)
    expect(a.ads.connected).toBe(true);
    expect(a.ads.campaigns.length).toBeGreaterThan(0);
    const camp = a.ads.campaigns[0]!;
    expect(camp.children?.length).toBeGreaterThan(0); // adset
    expect(camp.children![0]!.children?.length).toBeGreaterThan(0); // ад
    expect(a.ads.totals.spend).toBeGreaterThan(0);
  });

  it('Facebook page метрики во тековниот месец', async () => {
    const a = await getClientAnalytics(clientId, thisMonth(), thisMonth());
    expect(a.facebook.connected).toBe(true);
    expect(a.facebook.byMonth.length).toBeGreaterThan(0);
    expect(a.facebook.byMonth[0]!.followers).toBeGreaterThan(0);
  });
});
