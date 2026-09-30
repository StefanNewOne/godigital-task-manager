/**
 * ДЕМО податоци за Модул 3 · Мета — го полни огледалото (конекции, кампањи→ad sets→ads,
 * дневни insights, алерти, планови, инбокс, коментари, органика) за ~3 клиенти, за визуелен
 * преглед на СИТЕ Мета екрани. ПРИВРЕМЕНО (не е дел од каноничкиот seed).
 *
 *   pnpm db:meta-demo   (бара DATABASE_URL; прво изврши `pnpm db:demo` за клиентите/вработените)
 *
 * Детерминистички (фиксни uuid v7 литерали преку бројач + стабилни датуми) и идемпотентно
 * (upsert по вистинските @@unique клучеви; безбедно за повеќекратно извршување).
 *
 * NOTE: „Денес" за KPI-те (metaOverview.todaySpend, metaClientsRows.todaySpend) се чита од
 * `new Date()` во read слојот. Затоа денешните insight редови се датираат на реалниот ден на
 * извршување (UTC полноќ). Сè друго е стабилно. Ако сакаш и денешните бројки стабилни, изврши
 * го seed-от истиот ден кога гледаш.
 */
import { PrismaClient, type Prisma } from '../src/index.js';

const prisma = new PrismaClient();

// ─────────────────────────── Стабилни датуми ───────────────────────────
const utcMidnight = (isoDay: string): Date => new Date(`${isoDay}T00:00:00.000Z`);
const todayIso = (): string => new Date().toISOString().slice(0, 10);
// Ден пред N денови од референтен ден (стабилен: 2026-09-30), UTC.
const REF = utcMidnight('2026-09-30');
const daysAgo = (n: number): Date => new Date(REF.getTime() - n * 86_400_000);
const dayIso = (d: Date): string => d.toISOString().slice(0, 10);

// ─────────────────────────── Спецификација на демо ───────────────────────────
type Sev = 'crit' | 'high' | 'mid' | 'info';
type PlanStatus =
  'pending' | 'approved' | 'syncing' | 'done' | 'rejected' | 'mismatch' | 'withdrawn';
type Op = 'O1' | 'O2' | 'O3' | 'O4' | 'O5' | 'O6' | 'O7' | 'O8' | 'O9' | 'O10' | 'O11' | 'O12';
type ObjKey = 'msg' | 'thru' | 'reach' | 'traffic' | 'lead' | 'leadWeb' | 'cart' | 'buy';

interface CampaignSpec {
  slug: string; // за стабилни metaId
  name: string;
  objective: string; // ODAX objective (raw)
  objectiveKey: ObjKey;
  dailyBudget: number;
  effectiveStatus: 'ACTIVE' | 'PAUSED';
  adSets: AdSetSpec[];
}
interface AdSetSpec {
  slug: string;
  name: string;
  effectiveStatus: 'ACTIVE' | 'PAUSED';
  optimizationGoal: string;
  learningStage?: 'LEARNING' | 'LIMITED' | 'SUCCESS' | null;
  ads: AdSpec[];
}
interface AdSpec {
  slug: string;
  name: string;
  effectiveStatus: 'ACTIVE' | 'PAUSED';
  reviewStatus: 'approved' | 'pending' | 'rejected';
  /** metaMediaId на органски пост што е реупотребен во оваа реклама (за „во реклама"). */
  sourcePostMediaId?: string;
}

interface ClientMetaSpec {
  clientName: string; // резолвирано ПО ИМЕ
  adAccountId: string; // act_...
  pageId: string;
  igId: string;
  currency: string; // MKD
  accessLevel: 'write' | 'read' | 'none';
  targetText: string;
  campaigns: CampaignSpec[];
}

const SPEC: ClientMetaSpec[] = [
  {
    clientName: 'Ресторан ИВ',
    adAccountId: 'act_1000000001',
    pageId: '2000000001',
    igId: '3000000001',
    currency: 'MKD',
    accessLevel: 'write',
    targetText: 'Резервации · 30 разговори/месец под 120 ден.',
    campaigns: [
      {
        slug: 'riv-msg',
        name: 'Ресторан ИВ · Пораки · Есен',
        objective: 'OUTCOME_ENGAGEMENT',
        objectiveKey: 'msg',
        dailyBudget: 300,
        effectiveStatus: 'ACTIVE',
        adSets: [
          {
            slug: 'riv-msg-as1',
            name: 'Скопје 25-45 · интереси',
            effectiveStatus: 'ACTIVE',
            optimizationGoal: 'CONVERSATIONS',
            learningStage: 'SUCCESS',
            ads: [
              {
                slug: 'riv-msg-ad1',
                name: 'Reel · есенско мени',
                effectiveStatus: 'ACTIVE',
                reviewStatus: 'approved',
                sourcePostMediaId: 'ig_media_riv_1',
              },
              {
                slug: 'riv-msg-ad2',
                name: 'Карусел · специјалитети',
                effectiveStatus: 'ACTIVE',
                reviewStatus: 'approved',
              },
            ],
          },
          {
            slug: 'riv-msg-as2',
            name: 'Ремаркетинг · 30 дена',
            effectiveStatus: 'ACTIVE',
            optimizationGoal: 'CONVERSATIONS',
            learningStage: 'LIMITED',
            ads: [
              {
                slug: 'riv-msg-ad3',
                name: 'Стори · резервирај',
                effectiveStatus: 'ACTIVE',
                reviewStatus: 'approved',
              },
            ],
          },
        ],
      },
      {
        slug: 'riv-reach',
        name: 'Ресторан ИВ · Досег · Бренд',
        objective: 'OUTCOME_AWARENESS',
        objectiveKey: 'reach',
        dailyBudget: 150,
        effectiveStatus: 'ACTIVE',
        adSets: [
          {
            slug: 'riv-reach-as1',
            name: 'Широк досег · Скопје',
            effectiveStatus: 'ACTIVE',
            optimizationGoal: 'REACH',
            learningStage: 'SUCCESS',
            ads: [
              {
                slug: 'riv-reach-ad1',
                name: 'Видео · амбиент',
                effectiveStatus: 'ACTIVE',
                reviewStatus: 'approved',
              },
            ],
          },
        ],
      },
      {
        slug: 'riv-thru',
        name: 'Ресторан ИВ · ThruPlay · Промо',
        objective: 'OUTCOME_ENGAGEMENT',
        objectiveKey: 'thru',
        dailyBudget: 120,
        effectiveStatus: 'PAUSED',
        adSets: [
          {
            slug: 'riv-thru-as1',
            name: 'Видео гледачи',
            effectiveStatus: 'PAUSED',
            optimizationGoal: 'THRUPLAY',
            learningStage: null,
            ads: [
              {
                slug: 'riv-thru-ad1',
                name: 'Reel · 30с промо',
                effectiveStatus: 'PAUSED',
                reviewStatus: 'approved',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    clientName: 'Астибо',
    adAccountId: 'act_1000000002',
    pageId: '2000000002',
    igId: '3000000002',
    currency: 'MKD',
    accessLevel: 'read', // само за читање → планови не смеат да се создаваат (за да се види прагот)
    targetText: 'Лидови · инстант форма под 90 ден.',
    campaigns: [
      {
        slug: 'ast-lead',
        name: 'Астибо · Лидови · Есен',
        objective: 'OUTCOME_LEADS',
        objectiveKey: 'lead',
        dailyBudget: 400,
        effectiveStatus: 'ACTIVE',
        adSets: [
          {
            slug: 'ast-lead-as1',
            name: 'Инстант форма · интереси',
            effectiveStatus: 'ACTIVE',
            optimizationGoal: 'LEAD_GENERATION',
            learningStage: 'LEARNING',
            ads: [
              {
                slug: 'ast-lead-ad1',
                name: 'Карусел · понуда',
                effectiveStatus: 'ACTIVE',
                reviewStatus: 'approved',
              },
              {
                slug: 'ast-lead-ad2',
                name: 'Слика · попуст',
                effectiveStatus: 'ACTIVE',
                reviewStatus: 'pending',
              },
            ],
          },
        ],
      },
      {
        slug: 'ast-traffic',
        name: 'Астибо · Сообраќај · Веб',
        objective: 'OUTCOME_TRAFFIC',
        objectiveKey: 'traffic',
        dailyBudget: 200,
        effectiveStatus: 'ACTIVE',
        adSets: [
          {
            slug: 'ast-traffic-as1',
            name: 'Landing · сите производи',
            effectiveStatus: 'ACTIVE',
            optimizationGoal: 'LANDING_PAGE_VIEWS',
            learningStage: 'SUCCESS',
            ads: [
              {
                slug: 'ast-traffic-ad1',
                name: 'Видео · производи',
                effectiveStatus: 'ACTIVE',
                reviewStatus: 'approved',
                sourcePostMediaId: 'ig_media_ast_1',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    clientName: 'ГоМаркет',
    adAccountId: 'act_1000000003',
    pageId: '2000000003',
    igId: '3000000003',
    currency: 'MKD',
    accessLevel: 'write',
    targetText: 'Продажби · купувања, ROAS > 3.',
    campaigns: [
      {
        slug: 'gom-buy',
        name: 'ГоМаркет · Продажби · Купувања',
        objective: 'OUTCOME_SALES',
        objectiveKey: 'buy',
        dailyBudget: 500,
        effectiveStatus: 'ACTIVE',
        adSets: [
          {
            slug: 'gom-buy-as1',
            name: 'Каталог · ремаркетинг',
            effectiveStatus: 'ACTIVE',
            optimizationGoal: 'OFFSITE_CONVERSIONS',
            learningStage: 'SUCCESS',
            ads: [
              {
                slug: 'gom-buy-ad1',
                name: 'Каталог · динамичен',
                effectiveStatus: 'ACTIVE',
                reviewStatus: 'approved',
              },
            ],
          },
          {
            slug: 'gom-buy-as2',
            name: 'Prospecting · lookalike',
            effectiveStatus: 'ACTIVE',
            optimizationGoal: 'OFFSITE_CONVERSIONS',
            learningStage: 'LIMITED',
            ads: [
              {
                slug: 'gom-buy-ad2',
                name: 'Reel · бестселери',
                effectiveStatus: 'ACTIVE',
                reviewStatus: 'approved',
                sourcePostMediaId: 'ig_media_gom_1',
              },
              {
                slug: 'gom-buy-ad3',
                name: 'Слика · сезонски попуст',
                effectiveStatus: 'PAUSED',
                reviewStatus: 'rejected',
              },
            ],
          },
        ],
      },
      {
        slug: 'gom-cart',
        name: 'ГоМаркет · Додавања во кошничка',
        objective: 'OUTCOME_SALES',
        objectiveKey: 'cart',
        dailyBudget: 250,
        effectiveStatus: 'ACTIVE',
        adSets: [
          {
            slug: 'gom-cart-as1',
            name: 'ATC · интереси',
            effectiveStatus: 'ACTIVE',
            optimizationGoal: 'ADD_TO_CART',
            learningStage: 'LEARNING',
            ads: [
              {
                slug: 'gom-cart-ad1',
                name: 'Карусел · топ производи',
                effectiveStatus: 'ACTIVE',
                reviewStatus: 'approved',
              },
            ],
          },
        ],
      },
    ],
  },
];

// Deterministic „псевдо-случаен" seed за insight бројки (стабилно по slug+ден).
function hashNum(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 0xffffffff; // 0..1
}

async function main() {
  console.log('Мета демо: почеток…');

  // Резолвирање клиенти по име.
  const names = SPEC.map((s) => s.clientName);
  const clients = await prisma.client.findMany({ where: { name: { in: names } } });
  const clientByName = new Map(clients.map((c) => [c.name, c]));
  const missing = names.filter((n) => !clientByName.has(n));
  if (missing.length) {
    throw new Error(
      `Недостасуваат клиенти во базата: ${missing.join(', ')}. Прво изврши го основниот seed/db:demo.`,
    );
  }

  const emps = await prisma.employee.findMany();
  const byRole: Record<string, string> = {};
  for (const e of emps) byRole[e.role] = e.id;
  const authorId = byRole.ana ?? byRole.dir ?? emps[0]?.id;
  if (!authorId) throw new Error('Нема вработени во базата (createdById за планови бара актер).');

  const counts = {
    connections: 0,
    campaigns: 0,
    adSets: 0,
    ads: 0,
    insights: 0,
    alerts: 0,
    plans: 0,
    conversations: 0,
    messages: 0,
    comments: 0,
    publications: 0,
    metrics: 0,
    pageSnapshots: 0,
  };

  for (const spec of SPEC) {
    const client = clientByName.get(spec.clientName)!;

    // 1) Client Meta профил + врски (usesMetaAds, ad account/page/ig ids).
    await prisma.client.update({
      where: { id: client.id },
      data: {
        usesMetaAds: true,
        metaAdAccountId: spec.adAccountId,
        metaPageId: spec.pageId,
        metaIgId: spec.igId,
        metaTargetText: spec.targetText,
        metaTargetMetric: 'CPR',
        metaMaxDailyBudget: '1000' as unknown as Prisma.Decimal,
        metaFreqThreshold: '3.0' as unknown as Prisma.Decimal,
        metaCprAlertPct: 40,
        metaNamingConvention: '{Клиент} · {Objective} · {тема}',
        metaNotes: 'Демо профил за преглед на Мета модулот.',
      },
    });

    // 2) MetaConnection: adAccount + page + igAccount.
    const adConn = await prisma.metaConnection.upsert({
      where: {
        clientId_kind_metaId: {
          clientId: client.id,
          kind: 'adAccount',
          metaId: spec.adAccountId,
        },
      },
      create: {
        clientId: client.id,
        kind: 'adAccount',
        metaId: spec.adAccountId,
        name: `${spec.clientName} · Ads`,
        currency: spec.currency,
        accessLevel: spec.accessLevel,
        accountStatus: 'ACTIVE',
        amountSpent: '18540.00' as unknown as Prisma.Decimal,
        spendCap: '0' as unknown as Prisma.Decimal,
        lastSyncAt: daysAgo(0),
        syncFailCount: 0,
      },
      update: {
        currency: spec.currency,
        accessLevel: spec.accessLevel,
        accountStatus: 'ACTIVE',
        lastSyncAt: daysAgo(0),
        lastSyncError: null,
        syncFailCount: 0,
      },
    });
    counts.connections++;

    await prisma.metaConnection.upsert({
      where: {
        clientId_kind_metaId: { clientId: client.id, kind: 'page', metaId: spec.pageId },
      },
      create: {
        clientId: client.id,
        kind: 'page',
        metaId: spec.pageId,
        name: `${spec.clientName} · FB`,
        accessLevel: spec.accessLevel,
        lastSyncAt: daysAgo(0),
      },
      update: { lastSyncAt: daysAgo(0) },
    });
    counts.connections++;

    await prisma.metaConnection.upsert({
      where: {
        clientId_kind_metaId: { clientId: client.id, kind: 'igAccount', metaId: spec.igId },
      },
      create: {
        clientId: client.id,
        kind: 'igAccount',
        metaId: spec.igId,
        name: `${spec.clientName} · IG`,
        accessLevel: spec.accessLevel,
        igMessagesEnabled: true,
        lastSyncAt: daysAgo(0),
      },
      update: { igMessagesEnabled: true, lastSyncAt: daysAgo(0) },
    });
    counts.connections++;

    // 3) Кампањи → ad sets → ads (metaId е стабилен по slug; @unique за идемпотентност).
    for (const camp of spec.campaigns) {
      const campMetaId = `cmp_${camp.slug}`;
      const campaign = await prisma.metaCampaign.upsert({
        where: { metaId: campMetaId },
        create: {
          clientId: client.id,
          connectionId: adConn.id,
          metaId: campMetaId,
          name: camp.name,
          objective: camp.objective,
          objectiveKey: camp.objectiveKey,
          budgetStrategy: 'CBO',
          dailyBudget: String(camp.dailyBudget) as unknown as Prisma.Decimal,
          status: camp.effectiveStatus,
          effectiveStatus: camp.effectiveStatus,
          startTime: daysAgo(30),
          syncedAt: daysAgo(0),
        },
        update: {
          name: camp.name,
          objective: camp.objective,
          objectiveKey: camp.objectiveKey,
          dailyBudget: String(camp.dailyBudget) as unknown as Prisma.Decimal,
          status: camp.effectiveStatus,
          effectiveStatus: camp.effectiveStatus,
          syncedAt: daysAgo(0),
        },
      });
      counts.campaigns++;

      for (const as of camp.adSets) {
        const asMetaId = `as_${as.slug}`;
        const adSet = await prisma.metaAdSet.upsert({
          where: { metaId: asMetaId },
          create: {
            campaignId: campaign.id,
            metaId: asMetaId,
            name: as.name,
            status: as.effectiveStatus,
            effectiveStatus: as.effectiveStatus,
            optimizationGoal: as.optimizationGoal,
            learningStage: as.learningStage ?? null,
            learningStageSince: as.learningStage ? daysAgo(5) : null,
            syncedAt: daysAgo(0),
          },
          update: {
            name: as.name,
            status: as.effectiveStatus,
            effectiveStatus: as.effectiveStatus,
            optimizationGoal: as.optimizationGoal,
            learningStage: as.learningStage ?? null,
            syncedAt: daysAgo(0),
          },
        });
        counts.adSets++;

        for (const ad of as.ads) {
          const adMetaId = `ad_${ad.slug}`;
          await prisma.metaAd.upsert({
            where: { metaId: adMetaId },
            create: {
              adSetId: adSet.id,
              metaId: adMetaId,
              name: ad.name,
              status: ad.effectiveStatus,
              effectiveStatus: ad.effectiveStatus,
              reviewStatus: ad.reviewStatus,
              sourcePostMetaId: ad.sourcePostMediaId ?? null,
              cta: 'LEARN_MORE',
              syncedAt: daysAgo(0),
            },
            update: {
              name: ad.name,
              status: ad.effectiveStatus,
              effectiveStatus: ad.effectiveStatus,
              reviewStatus: ad.reviewStatus,
              sourcePostMetaId: ad.sourcePostMediaId ?? null,
              syncedAt: daysAgo(0),
            },
          });
          counts.ads++;
        }
      }
    }

    // 4) Дневни insights по ниво за секој објект: денес + 30-дневен спред.
    //    metaOverview/metaClientsRows читаат level='campaign', date=UTC-полноќ на денес.
    const insightDays = [
      // Денешен ред (реален ден на извршување — за KPI-те да не се празни).
      utcMidnight(todayIso()),
      // Стабилен 30-дневен спред (референца 2026-09-30).
      ...[1, 2, 3, 5, 7, 10, 14, 20, 28].map((d) => daysAgo(d)),
    ];

    for (const camp of spec.campaigns) {
      if (camp.effectiveStatus !== 'ACTIVE') continue; // паузирани немаат нова потрошувачка
      const campMetaId = `cmp_${camp.slug}`;
      for (const date of insightDays) {
        // Campaign-ниво = збир на неговите ad sets/ads (стабилни бројки по slug+ден).
        const r = hashNum(`${camp.slug}:${dayIso(date)}`);
        const spend = Math.round(camp.dailyBudget * (0.6 + 0.4 * r) * 100) / 100;
        const impressions = Math.round(spend * (35 + 25 * r));
        const reach = Math.round(impressions * (0.55 + 0.15 * r));
        const clicks = Math.round(impressions * (0.01 + 0.02 * r));
        const results = Math.max(1, Math.round(clicks * (0.15 + 0.25 * r)));
        const frequency = impressions > 0 && reach > 0 ? impressions / reach : 1;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;

        await prisma.metaInsightDaily.upsert({
          where: {
            level_objectMetaId_date: { level: 'campaign', objectMetaId: campMetaId, date },
          },
          create: {
            level: 'campaign',
            objectMetaId: campMetaId,
            clientId: client.id,
            date,
            spend: String(spend) as unknown as Prisma.Decimal,
            impressions,
            reach,
            frequency: frequency.toFixed(4) as unknown as Prisma.Decimal,
            clicks,
            ctr: ctr.toFixed(4) as unknown as Prisma.Decimal,
            results: String(results) as unknown as Prisma.Decimal,
            resultType: camp.objectiveKey,
            isFinal: date < daysAgo(7),
          },
          update: {
            spend: String(spend) as unknown as Prisma.Decimal,
            impressions,
            reach,
            frequency: frequency.toFixed(4) as unknown as Prisma.Decimal,
            clicks,
            ctr: ctr.toFixed(4) as unknown as Prisma.Decimal,
            results: String(results) as unknown as Prisma.Decimal,
            resultType: camp.objectiveKey,
          },
        });
        counts.insights++;

        // Ad set + ad ниво (за Клиент·Реклами KPI по ниво). По еден ad set/ad репрезентативно.
        for (const as of camp.adSets) {
          if (as.effectiveStatus !== 'ACTIVE') continue;
          const asMetaId = `as_${as.slug}`;
          const share = 1 / camp.adSets.length;
          const asSpend = Math.round(spend * share * 100) / 100;
          const asResults = Math.max(1, Math.round(results * share));
          await prisma.metaInsightDaily.upsert({
            where: {
              level_objectMetaId_date: { level: 'adset', objectMetaId: asMetaId, date },
            },
            create: {
              level: 'adset',
              objectMetaId: asMetaId,
              clientId: client.id,
              date,
              spend: String(asSpend) as unknown as Prisma.Decimal,
              impressions: Math.round(impressions * share),
              reach: Math.round(reach * share),
              clicks: Math.round(clicks * share),
              results: String(asResults) as unknown as Prisma.Decimal,
              resultType: camp.objectiveKey,
              isFinal: date < daysAgo(7),
            },
            update: {
              spend: String(asSpend) as unknown as Prisma.Decimal,
              results: String(asResults) as unknown as Prisma.Decimal,
            },
          });
          counts.insights++;

          for (const ad of as.ads) {
            if (ad.effectiveStatus !== 'ACTIVE') continue;
            const adMetaId = `ad_${ad.slug}`;
            const adShare = share / as.ads.length;
            const adSpend = Math.round(spend * adShare * 100) / 100;
            const adResults = Math.max(1, Math.round(results * adShare));
            await prisma.metaInsightDaily.upsert({
              where: {
                level_objectMetaId_date: { level: 'ad', objectMetaId: adMetaId, date },
              },
              create: {
                level: 'ad',
                objectMetaId: adMetaId,
                clientId: client.id,
                date,
                spend: String(adSpend) as unknown as Prisma.Decimal,
                impressions: Math.round(impressions * adShare),
                reach: Math.round(reach * adShare),
                clicks: Math.round(clicks * adShare),
                results: String(adResults) as unknown as Prisma.Decimal,
                resultType: camp.objectiveKey,
                isFinal: date < daysAgo(7),
              },
              update: {
                spend: String(adSpend) as unknown as Prisma.Decimal,
                results: String(adResults) as unknown as Prisma.Decimal,
              },
            });
            counts.insights++;
          }
        }
      }
    }
  }

  // 5) Алерти низ сериозности (crit/high/mid/info) — dedupeKey за идемпотентност.
  const riv = clientByName.get('Ресторан ИВ')!.id;
  const ast = clientByName.get('Астибо')!.id;
  const gom = clientByName.get('ГоМаркет')!.id;
  const alertSpecs: Array<{
    clientId: string;
    code: string;
    severity: Sev;
    title: string;
    detail: string;
    objectType?: string;
    objectMetaId?: string;
  }> = [
    {
      clientId: gom,
      code: 'A01',
      severity: 'crit',
      title: 'Рекламна сметка со проблем',
      detail: 'Потрошено се приближува до spend cap на сметката.',
      objectType: 'account',
      objectMetaId: 'act_1000000003',
    },
    {
      clientId: riv,
      code: 'A03',
      severity: 'crit',
      title: 'CPR над прагот +40%',
      detail: 'Цената по разговор порасна над зададениот праг за кампањата Пораки.',
      objectType: 'campaign',
      objectMetaId: 'cmp_riv-msg',
    },
    {
      clientId: ast,
      code: 'A05',
      severity: 'high',
      title: 'Ad set во продолжено учење',
      detail: 'Инстант форма · интереси е во LEARNING подолго од очекувано.',
      objectType: 'adset',
      objectMetaId: 'as_ast-lead-as1',
    },
    {
      clientId: riv,
      code: 'A06',
      severity: 'high',
      title: 'Висока фреквенција',
      detail: 'Фреквенцијата надмина 3.0 — можно заситување на публиката.',
      objectType: 'campaign',
      objectMetaId: 'cmp_riv-reach',
    },
    {
      clientId: gom,
      code: 'A08',
      severity: 'mid',
      title: 'Реклама одбиена',
      detail: 'Слика · сезонски попуст е одбиена при преглед.',
      objectType: 'ad',
      objectMetaId: 'ad_gom-buy-ad3',
    },
    {
      clientId: ast,
      code: 'A09',
      severity: 'mid',
      title: 'Реклама на чекање преглед',
      detail: 'Слика · попуст чека преглед подолго од 24 ч.',
      objectType: 'ad',
      objectMetaId: 'ad_ast-lead-ad2',
    },
    {
      clientId: riv,
      code: 'A12',
      severity: 'info',
      title: 'Sync успешен',
      detail: 'Последна синхронизација завршена без грешки.',
      objectType: 'account',
      objectMetaId: 'act_1000000001',
    },
  ];
  for (const a of alertSpecs) {
    const dedupeKey = `demo:${a.code}:${a.objectMetaId ?? a.clientId}`;
    await prisma.metaAlert.upsert({
      where: { dedupeKey },
      create: {
        clientId: a.clientId,
        code: a.code,
        severity: a.severity,
        objectType: a.objectType ?? null,
        objectMetaId: a.objectMetaId ?? null,
        title: a.title,
        detail: a.detail,
        state: 'new',
        firstSeenAt: daysAgo(2),
        lastSeenAt: daysAgo(0),
        occurrences: 1,
        dedupeKey,
      },
      update: { severity: a.severity, title: a.title, detail: a.detail, lastSeenAt: daysAgo(0) },
    });
    counts.alerts++;
  }

  // 6) Планови за промена низ статуси + операции (idempotencyKey за идемпотентност).
  const planSpecs: Array<{
    clientId: string;
    op: Op;
    status: PlanStatus;
    target: Record<string, string>;
    note: string;
    after?: Record<string, unknown>;
  }> = [
    {
      clientId: riv,
      op: 'O2',
      status: 'pending',
      target: { campaignId: 'cmp_riv-msg' },
      note: 'Зголеми дневен буџет поради добар CPR.',
      after: { dailyBudget: 350 },
    },
    {
      clientId: gom,
      op: 'O1',
      status: 'approved',
      target: { adId: 'ad_gom-buy-ad3' },
      note: 'Паузирај одбиена реклама.',
      after: { status: 'PAUSED' },
    },
    {
      clientId: ast,
      op: 'O9',
      status: 'syncing',
      target: { campaignId: 'cmp_ast-lead' },
      note: 'Постави краен датум на кампањата.',
      after: { stopTime: '2026-10-15' },
    },
    {
      clientId: gom,
      op: 'O8',
      status: 'done',
      target: {},
      note: 'Нова кампања · зимска сезона (направено).',
    },
    {
      clientId: riv,
      op: 'O11',
      status: 'rejected',
      target: { adSetId: 'as_riv-msg-as2' },
      note: 'Преименување не е потребно засега.',
    },
    {
      clientId: ast,
      op: 'O3',
      status: 'mismatch',
      target: { campaignId: 'cmp_ast-traffic' },
      note: 'Закажан буџет — нема совпаѓање по 24 ч.',
      after: { dailyBudget: 300 },
    },
    {
      clientId: gom,
      op: 'O6',
      status: 'withdrawn',
      target: { adSetId: 'as_gom-buy-as2' },
      note: 'Копирање ad set — повлечено.',
    },
  ];
  for (let i = 0; i < planSpecs.length; i++) {
    const p = planSpecs[i]!;
    const idempotencyKey = `demo-plan:${p.clientId}:${p.op}:${i}`;
    const approved = ['approved', 'syncing', 'done'].includes(p.status);
    await prisma.metaChangePlan.upsert({
      where: { idempotencyKey },
      create: {
        clientId: p.clientId,
        op: p.op,
        target: p.target as Prisma.InputJsonValue,
        params: {} as Prisma.InputJsonValue,
        before: {} as Prisma.InputJsonValue,
        after: (p.after ?? undefined) as Prisma.InputJsonValue | undefined,
        consequences: [],
        warnings: [],
        status: p.status,
        createdById: authorId,
        createdVia: 'manual',
        note: p.note,
        rejectNote: p.status === 'rejected' ? p.note : null,
        approvedById: approved ? authorId : null,
        approvedAt: approved ? daysAgo(3) : null,
        markedDoneAt: ['syncing', 'done', 'mismatch'].includes(p.status) ? daysAgo(2) : null,
        confirmedAt: p.status === 'done' ? daysAgo(1) : null,
        idempotencyKey,
      },
      update: { status: p.status, note: p.note },
    });
    counts.plans++;
  }

  // 7) Инбокс: разговори + пораки (metaThreadId/metaMessageId @unique).
  const convoSpecs: Array<{
    clientId: string;
    connKind: 'page' | 'igAccount';
    pageOrIg: string;
    thread: string;
    channel: 'messenger' | 'instagram';
    participant: string;
    topic: string;
    unread: boolean;
    sourceAdMetaId?: string;
    messages: Array<{ id: string; fromPage: boolean; text: string; daysAgo: number }>;
  }> = [
    {
      clientId: riv,
      connKind: 'igAccount',
      pageOrIg: '3000000001',
      thread: 't_riv_1',
      channel: 'instagram',
      participant: 'Марија С.',
      topic: 'резервација',
      unread: true,
      sourceAdMetaId: 'ad_riv-msg-ad1',
      messages: [
        {
          id: 'm_riv_1_1',
          fromPage: false,
          text: 'Дали имате слободна маса за 4 вечерва?',
          daysAgo: 0,
        },
        {
          id: 'm_riv_1_2',
          fromPage: true,
          text: 'Здраво! Да, имаме во 20:00. Да резервирам?',
          daysAgo: 0,
        },
        { id: 'm_riv_1_3', fromPage: false, text: 'Да, ве молам.', daysAgo: 0 },
      ],
    },
    {
      clientId: riv,
      connKind: 'page',
      pageOrIg: '2000000001',
      thread: 't_riv_2',
      channel: 'messenger',
      participant: 'Кирил П.',
      topic: 'мени',
      unread: false,
      messages: [
        { id: 'm_riv_2_1', fromPage: false, text: 'Дали имате вегетаријанско мени?', daysAgo: 3 },
        {
          id: 'm_riv_2_2',
          fromPage: true,
          text: 'Да, имаме неколку опции. Еве го линкот.',
          daysAgo: 3,
        },
      ],
    },
    {
      clientId: ast,
      connKind: 'igAccount',
      pageOrIg: '3000000002',
      thread: 't_ast_1',
      channel: 'instagram',
      participant: 'Ана Т.',
      topic: 'цена',
      unread: true,
      sourceAdMetaId: 'ad_ast-lead-ad1',
      messages: [
        { id: 'm_ast_1_1', fromPage: false, text: 'Колку чини пакетот од рекламата?', daysAgo: 1 },
      ],
    },
    {
      clientId: gom,
      connKind: 'igAccount',
      pageOrIg: '3000000003',
      thread: 't_gom_1',
      channel: 'instagram',
      participant: 'Дејан М.',
      topic: 'достава',
      unread: false,
      sourceAdMetaId: 'ad_gom-buy-ad2',
      messages: [
        {
          id: 'm_gom_1_1',
          fromPage: false,
          text: 'Дали доставувате низ цела Македонија?',
          daysAgo: 2,
        },
        {
          id: 'm_gom_1_2',
          fromPage: true,
          text: 'Да, доставата е бесплатна над 2000 ден.',
          daysAgo: 2,
        },
      ],
    },
  ];
  for (const cv of convoSpecs) {
    const conn = await prisma.metaConnection.findFirst({
      where: { clientId: cv.clientId, kind: cv.connKind, metaId: cv.pageOrIg },
    });
    if (!conn) continue;
    const lastMsg = cv.messages[cv.messages.length - 1]!;
    const conv = await prisma.metaConversation.upsert({
      where: { metaThreadId: cv.thread },
      create: {
        clientId: cv.clientId,
        connectionId: conn.id,
        metaThreadId: cv.thread,
        channel: cv.channel,
        participantName: cv.participant,
        sourceAdMetaId: cv.sourceAdMetaId ?? null,
        lastMessageAt: daysAgo(lastMsg.daysAgo),
        unread: cv.unread,
        waitingSince: cv.unread ? daysAgo(lastMsg.daysAgo) : null,
        topic: cv.topic,
      },
      update: {
        lastMessageAt: daysAgo(lastMsg.daysAgo),
        unread: cv.unread,
        topic: cv.topic,
      },
    });
    counts.conversations++;
    for (const m of cv.messages) {
      await prisma.metaMessage.upsert({
        where: { metaMessageId: m.id },
        create: {
          conversationId: conv.id,
          metaMessageId: m.id,
          fromPage: m.fromPage,
          text: m.text,
          sentAt: daysAgo(m.daysAgo),
        },
        update: { text: m.text },
      });
      counts.messages++;
    }
  }

  // 8) Коментари (metaCommentId @unique). Прашања/поплаки за филтрите.
  const commentSpecs: Array<{
    clientId: string;
    id: string;
    parent: 'ad' | 'post';
    parentMetaId: string;
    author: string;
    text: string;
    isQuestion?: boolean;
    isComplaint?: boolean;
  }> = [
    {
      clientId: riv,
      id: 'cmt_riv_1',
      parent: 'ad',
      parentMetaId: 'ad_riv-msg-ad1',
      author: 'Стефан Р.',
      text: 'Кое е работното време во недела?',
      isQuestion: true,
    },
    {
      clientId: riv,
      id: 'cmt_riv_2',
      parent: 'post',
      parentMetaId: 'ig_media_riv_1',
      author: 'Елена К.',
      text: 'Одлично изгледа! 😍',
    },
    {
      clientId: ast,
      id: 'cmt_ast_1',
      parent: 'ad',
      parentMetaId: 'ad_ast-lead-ad1',
      author: 'Игор В.',
      text: 'Чекам одговор веќе два дена, ова е неприфатливо.',
      isComplaint: true,
    },
    {
      clientId: gom,
      id: 'cmt_gom_1',
      parent: 'ad',
      parentMetaId: 'ad_gom-buy-ad2',
      author: 'Билјана Н.',
      text: 'Дали има попуст за повеќе парчиња?',
      isQuestion: true,
    },
  ];
  for (const cm of commentSpecs) {
    await prisma.metaComment.upsert({
      where: { metaCommentId: cm.id },
      create: {
        clientId: cm.clientId,
        metaCommentId: cm.id,
        parentObjectType: cm.parent,
        parentMetaId: cm.parentMetaId,
        authorName: cm.author,
        text: cm.text,
        createdTime: daysAgo(1),
        isQuestion: cm.isQuestion ?? false,
        isComplaint: cm.isComplaint ?? false,
      },
      update: {
        text: cm.text,
        isQuestion: cm.isQuestion ?? false,
        isComplaint: cm.isComplaint ?? false,
      },
    });
    counts.comments++;
  }

  // 9) Органика: IG публикации (account-ниво, без таск) + MetricSnapshot + PageSnapshot.
  //    metaClientOrganic чита Publication{platform:ig, clientId, publishedAt} + latest MetricSnapshot.
  //    sourcePostMediaId погоре ги врзува некои во реклама („во реклама").
  const organicSpecs: Array<{
    clientId: string;
    mediaId: string;
    caption: string;
    mediaType: string;
    daysAgo: number;
    reach: number;
    views: number;
    engagement: number;
  }> = [
    {
      clientId: riv,
      mediaId: 'ig_media_riv_1',
      caption: 'Есенско мени 🍂',
      mediaType: 'VIDEO',
      daysAgo: 3,
      reach: 12400,
      views: 9800,
      engagement: 640,
    },
    {
      clientId: riv,
      mediaId: 'ig_media_riv_2',
      caption: 'Викенд специјалитет',
      mediaType: 'IMAGE',
      daysAgo: 8,
      reach: 5600,
      views: 0,
      engagement: 210,
    },
    {
      clientId: ast,
      mediaId: 'ig_media_ast_1',
      caption: 'Нова колекција',
      mediaType: 'CAROUSEL_ALBUM',
      daysAgo: 5,
      reach: 8900,
      views: 0,
      engagement: 430,
    },
    {
      clientId: gom,
      mediaId: 'ig_media_gom_1',
      caption: 'Бестселери на неделата',
      mediaType: 'VIDEO',
      daysAgo: 2,
      reach: 15300,
      views: 12100,
      engagement: 880,
    },
    {
      clientId: gom,
      mediaId: 'ig_media_gom_2',
      caption: 'Сезонски попусти',
      mediaType: 'IMAGE',
      daysAgo: 10,
      reach: 4200,
      views: 0,
      engagement: 150,
    },
  ];
  for (const o of organicSpecs) {
    // Publication: backfill account-ниво (taskId=null, clientId set). Нема @unique за ова →
    // резолвирај по (clientId, metaMediaId) рачно за идемпотентност.
    let pub = await prisma.publication.findFirst({
      where: { clientId: o.clientId, metaMediaId: o.mediaId },
    });
    if (!pub) {
      pub = await prisma.publication.create({
        data: {
          clientId: o.clientId,
          platform: 'ig',
          postType:
            o.mediaType === 'VIDEO'
              ? 'reel'
              : o.mediaType === 'CAROUSEL_ALBUM'
                ? 'carousel'
                : 'post',
          publishedAt: daysAgo(o.daysAgo),
          permalink: `https://instagram.com/p/${o.mediaId}`,
          metaMediaId: o.mediaId,
          mediaType: o.mediaType,
          caption: o.caption,
          resolveStatus: 'resolved',
        },
      });
      counts.publications++;
    }
    // MetricSnapshot: append-only. Резолвирај постоечки по publicationId за идемпотентност.
    const existingSnap = await prisma.metricSnapshot.findFirst({
      where: { publicationId: pub.id },
    });
    if (!existingSnap) {
      await prisma.metricSnapshot.create({
        data: {
          publicationId: pub.id,
          capturedAt: daysAgo(o.daysAgo),
          raw: {},
          reach: String(o.reach) as unknown as Prisma.Decimal,
          views: String(o.views) as unknown as Prisma.Decimal,
          engagement: String(o.engagement) as unknown as Prisma.Decimal,
        },
      });
      counts.metrics++;
    }
  }

  // PageSnapshot по клиент (страница метрики — append-only; резолвирај по (clientId, capturedAt)).
  for (const spec of SPEC) {
    const client = clientByName.get(spec.clientName)!;
    const capturedAt = daysAgo(1);
    const existing = await prisma.pageSnapshot.findFirst({
      where: { clientId: client.id, capturedAt },
    });
    if (!existing) {
      const r = hashNum(spec.clientName);
      await prisma.pageSnapshot.create({
        data: {
          clientId: client.id,
          capturedAt,
          followers: Math.round(4000 + 8000 * r),
          engagement: Math.round(300 + 500 * r),
          pageViews: Math.round(800 + 1200 * r),
          newFollows: Math.round(20 + 80 * r),
          videoViews: Math.round(2000 + 5000 * r),
          reactions: Math.round(150 + 300 * r),
          raw: {},
        },
      });
      counts.pageSnapshots++;
    }
  }

  console.log('Мета демо готово:', JSON.stringify(counts, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
