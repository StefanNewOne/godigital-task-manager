import { describe, expect, it } from 'vitest';
import { StubMetaClient } from './metaClient.stub.js';

/** Модул 3 · Мета — новите read методи на stub (детерминистички, за М2 sync). */
describe('StubMetaClient · нови read методи (§6)', () => {
  const c = new StubMetaClient();

  it('listAdAccountsDetailed: валута + Partner задачи', async () => {
    const accts = await c.listAdAccountsDetailed();
    expect(accts.length).toBeGreaterThan(0);
    expect(accts[0]!.currency).toBe('EUR');
    expect(accts[0]!.userTasks).toContain('ANALYZE');
    expect(accts[1]!.currency).toBe('USD');
  });

  it('fetchStructure: кампања → ad set → ад, поврзани преку metaId', async () => {
    const s = await c.fetchStructure('act_1');
    expect(s.campaigns).toHaveLength(1);
    expect(s.adsets[0]!.campaignMetaId).toBe(s.campaigns[0]!.metaId);
    expect(s.ads[0]!.adSetMetaId).toBe(s.adsets[0]!.metaId);
  });

  it('fetchStructure е детерминистички', async () => {
    const a = await c.fetchStructure('act_1');
    const b = await c.fetchStructure('act_1');
    expect(a).toEqual(b);
  });

  it('fetchInsightsDaily: ред по ниво со spend/results', async () => {
    const rows = await c.fetchInsightsDaily('act_1', 'campaign', '2035-06-01', '2035-06-01');
    expect(rows[0]!.level).toBe('campaign');
    expect(rows[0]!.spend).toBeGreaterThan(0);
    expect(rows[0]!.date).toBe('2035-06-01');
  });

  it('инбокс: разговори, пораки, коментари', async () => {
    expect((await c.fetchPageConversations('page_1'))[0]!.channel).toBe('messenger');
    expect((await c.fetchIgConversations('ig_1'))[0]!.channel).toBe('instagram');
    const msgs = await c.fetchConversationMessages('t_1');
    expect(msgs.some((m) => m.fromPage)).toBe(true);
    expect((await c.fetchComments('post_1'))[0]!.parentMetaId).toBe('post_1');
  });

  it('checkIgMessagingAccess + debugToken', async () => {
    expect(typeof (await c.checkIgMessagingAccess('ig_1'))).toBe('boolean');
    const t = await c.debugToken('some-token');
    expect(t.isValid).toBe(true);
    expect(Array.isArray(t.scopes)).toBe(true);
  });

  it('нема write методи (D1) — само read во интерфејсот', () => {
    const proto = Object.getOwnPropertyNames(StubMetaClient.prototype);
    const forbidden = proto.filter((m) => /send|reply|delete|hide|create|update|post/i.test(m));
    expect(forbidden).toEqual([]);
  });
});
