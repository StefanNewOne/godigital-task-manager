import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@gd/db';
import { setMetaClient } from '../services/meta/metaClient.js';
import { StubMetaClient } from '../services/meta/metaClient.stub.js';
import {
  syncConnections,
  syncInsightsForClient,
  syncStructureForClient,
} from '../services/meta/sync.js';
import { evaluateAlerts } from '../services/meta/alertEval.js';

/** Модул 3 · Мета — М2a sync: огледалото се полни од MetaClient (stub). */
const db = new PrismaClient();
const AD_ACCT = 'act_stub_1';
const NAME = 'ТЕСТ Meta Sync';
let clientId = '';

async function cleanup() {
  const clients = await db.client.findMany({ where: { name: NAME } });
  for (const c of clients) {
    await db.metaInsightDaily.deleteMany({ where: { clientId: c.id } });
    await db.metaAlert.deleteMany({ where: { clientId: c.id } });
    // MetaConnection → Campaign → AdSet → Ad каскадно
    await db.metaConnection.deleteMany({ where: { clientId: c.id } });
    await db.client.delete({ where: { id: c.id } });
  }
}

beforeAll(async () => {
  setMetaClient(new StubMetaClient()); // форсирај stub (и покрај реален токен во .env.local)
  await cleanup();
  const c = await db.client.create({
    data: {
      name: NAME,
      color: '#0866FF',
      contractStart: new Date(Date.UTC(2035, 0, 1)),
      contractMonths: 12,
      usesMetaAds: true,
      metaAdAccountId: AD_ACCT,
    },
  });
  clientId = c.id;
});

afterAll(async () => {
  await cleanup();
  setMetaClient(null);
  await db.$disconnect();
});

describe('Meta sync (М2a)', () => {
  it('syncConnections создава adAccount поврзување со валута + пристап', async () => {
    await syncConnections();
    const conn = await db.metaConnection.findFirst({ where: { clientId, kind: 'adAccount' } });
    expect(conn?.metaId).toBe(AD_ACCT);
    expect(conn?.currency).toBe('EUR');
    expect(conn?.accessLevel).toBe('write'); // ANALYZE+ADVERTISE → write
  });

  it('syncStructure полни кампања→ad set→ад, поврзани + objectiveKey', async () => {
    const r = await syncStructureForClient(clientId);
    expect(r.campaigns).toBe(1);
    const camp = await db.metaCampaign.findFirst({ where: { clientId } });
    expect(camp?.objectiveKey).toBe('msg'); // OUTCOME_ENGAGEMENT → msg
    const adset = await db.metaAdSet.findFirst({ where: { campaignId: camp!.id } });
    expect(adset).toBeTruthy();
    const ad = await db.metaAd.findFirst({ where: { adSetId: adset!.id } });
    expect(ad?.reviewStatus).toBeTruthy();
  });

  it('syncStructure е идемпотентен (upsert по metaId, без дупликати)', async () => {
    await syncStructureForClient(clientId);
    await syncStructureForClient(clientId);
    expect(await db.metaCampaign.count({ where: { clientId } })).toBe(1);
  });

  it('syncInsights полни дневни редови по ниво', async () => {
    const r = await syncInsightsForClient(clientId, '2035-06-01', false);
    expect(r.rows).toBe(3); // campaign + adset + ad
    const rows = await db.metaInsightDaily.findMany({ where: { clientId } });
    expect(rows.some((x) => x.level === 'campaign')).toBe(true);
    expect(rows.every((x) => x.isFinal === false)).toBe(true);
    expect(Number(rows[0]!.spend)).toBeGreaterThan(0);
  });
});

describe('Meta алерти (М2b)', () => {
  it('одбиена реклама → A01 (crit); поправена → auto-resolve', async () => {
    // Постави одбиена реклама
    const ad = await db.metaAd.findFirst({ where: { adSet: { campaign: { clientId } } } });
    await db.metaAd.update({ where: { id: ad!.id }, data: { reviewStatus: 'rejected' } });

    await evaluateAlerts();
    const alert = await db.metaAlert.findFirst({ where: { clientId, code: 'A01' } });
    expect(alert?.severity).toBe('crit');
    expect(alert?.state).toBe('new');
    expect(alert?.objectMetaId).toBe(ad!.metaId);

    // Поправи → следната евалуација ја решава
    await db.metaAd.update({ where: { id: ad!.id }, data: { reviewStatus: 'approved' } });
    await evaluateAlerts();
    const resolved = await db.metaAlert.findFirst({ where: { clientId, code: 'A01' } });
    expect(resolved?.state).toBe('resolved');
  });

  it('dedupe: повторна евалуација не дуплира, бројач расте', async () => {
    const ad = await db.metaAd.findFirst({ where: { adSet: { campaign: { clientId } } } });
    await db.metaAd.update({ where: { id: ad!.id }, data: { reviewStatus: 'rejected' } });
    await evaluateAlerts();
    await evaluateAlerts();
    const alerts = await db.metaAlert.findMany({ where: { clientId, code: 'A01' } });
    expect(alerts).toHaveLength(1);
    expect(alerts[0]!.occurrences).toBeGreaterThan(1);
    await db.metaAd.update({ where: { id: ad!.id }, data: { reviewStatus: 'approved' } });
  });
});
