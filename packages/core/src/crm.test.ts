import { describe, expect, it } from 'vitest';
import {
  CRM_FLOW,
  CRM_STATUSES,
  CRM_STATUS_META,
  CRM_TRANSITIONS,
  CRM_TERMINAL,
  CRM_PLAN_MONTHS,
  allowedCrmTargets,
  crmDefaultTeamRoles,
  crmForwardTarget,
  crmIsStale,
  crmLastVersionOk,
  crmMissing,
  crmPkgMissing,
  crmPlanKeys,
  crmPlanMonthOk,
  crmReactivateTarget,
  crmStage,
  findCrmTransition,
  isCrmBoardDraggable,
  type CrmLeadView,
  type CrmPkgView,
  type CrmStatus,
} from './crm.js';

describe('CRM state machine — интегритет', () => {
  it('секој статус има метаподатоци', () => {
    for (const s of CRM_STATUSES) {
      expect(CRM_STATUS_META[s]).toBeDefined();
      expect(CRM_STATUS_META[s].label.length).toBeGreaterThan(0);
    }
  });

  it('CRM_FLOW е 11 работни чекори по редослед', () => {
    expect(CRM_FLOW).toHaveLength(11);
    CRM_FLOW.forEach((s, i) => expect(CRM_STATUS_META[s].step).toBe(i + 1));
  });

  it('терминалните немаат сопственик', () => {
    for (const t of CRM_TERMINAL) expect(CRM_STATUS_META[t].owner).toBeNull();
  });

  it('секој работен чекор води до точно еден нареден (forward), освен активација→активиран', () => {
    for (const s of CRM_FLOW) {
      const fwd = CRM_TRANSITIONS.filter((r) => r.from === s && r.kind === 'forward');
      expect(fwd).toHaveLength(1);
    }
    expect(crmForwardTarget('aktivacija')).toBe('aktiviran');
    expect(crmForwardTarget('novLid')).toBe('analiza');
  });

  it('одобрувачките чекори ги носи директорот; останатите агентот', () => {
    expect(CRM_STATUS_META.ponudaOdob.owner).toBe('dir');
    expect(CRM_STATUS_META.dogOdob.owner).toBe('dir');
    expect(CRM_STATUS_META.analiza.owner).toBe('agent');
    // директорските преоди имаат actor 'dir'
    expect(findCrmTransition('ponudaOdob', 'ponudaKlient')?.actor).toBe('dir');
    expect(findCrmTransition('dogOdob', 'dogKlient')?.actor).toBe('dir');
  });

  it('враќање со коментар има G_COMMENT и бара внес', () => {
    for (const [from, to] of [
      ['ponudaOdob', 'ponudaIzr'],
      ['ponudaKlient', 'ponudaIzr'],
      ['dogOdob', 'dogIzr'],
      ['dogKlient', 'dogIzr'],
    ] as [CrmStatus, CrmStatus][]) {
      const r = findCrmTransition(from, to)!;
      expect(r.guards).toContain('G_COMMENT');
      expect(r.requiresInput).toBe(true);
      expect(r.kind).toBe('return');
    }
  });

  it('изгубен само од чекор 5 (ponudaKlient) и 9 (dogKlient)', () => {
    const losers = CRM_TRANSITIONS.filter((r) => r.to === 'izguben').map((r) => r.from);
    expect(losers.sort()).toEqual(['dogKlient', 'ponudaKlient']);
    for (const from of losers) {
      expect(findCrmTransition(from as CrmStatus, 'izguben')?.guards).toContain('G_LOSS_REASON');
    }
  });

  it('реактивација води во изработка на понуда или договор', () => {
    expect(crmReactivateTarget('ponudaKlient')).toBe('ponudaIzr');
    expect(crmReactivateTarget('dogKlient')).toBe('dogIzr');
  });
});

describe('CRM Board drag-and-drop', () => {
  it('само forward преодот е драг-дозволен', () => {
    expect(isCrmBoardDraggable('novLid', 'analiza')).toBe(true);
    expect(isCrmBoardDraggable('ponudaOdob', 'ponudaKlient')).toBe(true);
    // враќање/губење не се драг-дозволени
    expect(isCrmBoardDraggable('ponudaOdob', 'ponudaIzr')).toBe(false);
    expect(isCrmBoardDraggable('ponudaKlient', 'izguben')).toBe(false);
    // назад не постои преод
    expect(isCrmBoardDraggable('analiza', 'novLid')).toBe(false);
  });

  it('allowedCrmTargets ги дава сите излези', () => {
    expect(allowedCrmTargets('ponudaKlient').sort()).toEqual(['izguben', 'ponudaIzr', 'sostanok']);
    expect(allowedCrmTargets('novLid')).toEqual(['analiza']);
  });
});

describe('crmStage / crmIsStale', () => {
  it('изгубен го користи чекорот од кој паднал', () => {
    expect(crmStage('izguben', 'ponudaKlient')).toBe(5);
    expect(crmStage('aktivacija')).toBe(11);
  });

  it('застарен по CRM_STALE_DAYS, но не за терминални', () => {
    expect(crmIsStale('ponudaKlient', 5)).toBe(true);
    expect(crmIsStale('ponudaKlient', 4)).toBe(false);
    expect(crmIsStale('aktiviran', 9)).toBe(false);
    expect(crmIsStale('izguben', 9)).toBe(false);
  });
});

describe('crmPlanKeys / crmDefaultTeamRoles', () => {
  it('враќа CRM_PLAN_MONTHS последователни YYYY-MM, со преод преку година', () => {
    expect(crmPlanKeys('2026-10')).toEqual(['2026-10', '2026-11', '2026-12']);
    expect(crmPlanKeys('2026-11')).toEqual(['2026-11', '2026-12', '2027-01']);
    expect(crmPlanKeys('2026-10')).toHaveLength(CRM_PLAN_MONTHS);
    // без месец → почнува од јануари (робусност)
    expect(crmPlanKeys('2026')).toEqual(['2026-01', '2026-02', '2026-03']);
  });

  it('стандарден тим: АМ секогаш, останатите по пакет', () => {
    expect(crmDefaultTeamRoles({ videos: 2, graphics: 4, meta: true })).toEqual({
      am: true,
      rez: true,
      krea: true,
      ana: true,
    });
    expect(crmDefaultTeamRoles({ videos: 0, graphics: 6, meta: false })).toEqual({
      am: true,
      rez: false,
      krea: true,
      ana: false,
    });
  });
});

describe('crmMissing — задолжителен внес по чекор', () => {
  const pkg: CrmPkgView = {
    videos: 2,
    graphics: 4,
    meta: true,
    start: '2026-10',
    months: 6,
    calType: 'специфичен',
  };
  const base = (over: Partial<CrmLeadView>): CrmLeadView => ({
    status: 'novLid',
    hasAnalysis: false,
    offers: [],
    contracts: [],
    meeting: null,
    pkg,
    hasSigned: false,
    hasStrategy: false,
    hasFable: false,
    planCountsByMonth: {},
    ...over,
  });

  it('novLid нема задолжителен внес', () => {
    expect(crmMissing(base({ status: 'novLid' }))).toEqual([]);
  });

  it('analiza бара документ за анализа', () => {
    expect(crmMissing(base({ status: 'analiza' }))).toEqual(['документ за анализа']);
    expect(crmMissing(base({ status: 'analiza', hasAnalysis: true }))).toEqual([]);
  });

  it('ponudaIzr бара нова верзија понуда', () => {
    expect(crmMissing(base({ status: 'ponudaIzr' }))).toEqual(['понуда v1']);
    expect(
      crmMissing(
        base({ status: 'ponudaIzr', offers: [{ returned: true, clientReturned: false }] }),
      ),
    ).toEqual(['понуда v2']);
    expect(
      crmMissing(
        base({ status: 'ponudaIzr', offers: [{ returned: false, clientReturned: false }] }),
      ),
    ).toEqual([]);
  });

  it('sostanok бара датум/час, потврда и аудио-или-заклучоци', () => {
    expect(crmMissing(base({ status: 'sostanok' }))).toContain('датум и час на состанок');
    expect(
      crmMissing(
        base({
          status: 'sostanok',
          meeting: {
            date: '2026-10-01',
            time: '10:00',
            held: false,
            hasAudio: false,
            hasNotes: false,
          },
        }),
      ),
    ).toContain('потврда дека состанокот е одржан');
    expect(
      crmMissing(
        base({
          status: 'sostanok',
          meeting: {
            date: '2026-10-01',
            time: '10:00',
            held: true,
            hasAudio: false,
            hasNotes: true,
          },
        }),
      ),
    ).toEqual([]);
  });

  it('dogIzr бара пакет-полиња + верзија договор', () => {
    const emptyPkg: CrmPkgView = {
      videos: 0,
      graphics: 0,
      meta: false,
      start: '',
      months: 0,
      calType: 'специфичен',
    };
    expect(crmMissing(base({ status: 'dogIzr', pkg: emptyPkg }))).toEqual([
      'број видеа/графики',
      'старт датум',
      'должина на договор',
      'договор v1',
    ]);
    expect(
      crmMissing(
        base({ status: 'dogIzr', contracts: [{ returned: false, clientReturned: false }] }),
      ),
    ).toEqual([]);
  });

  it('dogKlient бара потпишан договор', () => {
    expect(crmMissing(base({ status: 'dogKlient' }))).toEqual(['потпишан договор']);
    expect(crmMissing(base({ status: 'dogKlient', hasSigned: true }))).toEqual([]);
  });

  it('strategija/aktivacija бараат стратегија, Fable и датуми (специфичен календар)', () => {
    const m = crmMissing(base({ status: 'strategija' }));
    expect(m).toContain('стратегија за 90 дена');
    expect(m).toContain('Fable 5 фајл');
    expect(m.some((x) => x.startsWith('датуми во планерот'))).toBe(true);

    // комплетно пополнет специфичен план
    const full = base({
      status: 'aktivacija',
      hasStrategy: true,
      hasFable: true,
      planCountsByMonth: {
        '2026-10': { v: 2, g: 4 },
        '2026-11': { v: 2, g: 4 },
        '2026-12': { v: 2, g: 4 },
      },
    });
    expect(crmMissing(full)).toEqual([]);
  });

  it('стандарден календар не бара датуми во планерот', () => {
    const std = base({
      status: 'aktivacija',
      hasStrategy: true,
      hasFable: true,
      pkg: { ...pkg, calType: 'стандарден' },
    });
    expect(crmMissing(std)).toEqual([]);
  });
});

describe('helpers', () => {
  it('crmLastVersionOk', () => {
    expect(crmLastVersionOk([])).toBe(false);
    expect(crmLastVersionOk([{ returned: true, clientReturned: false }])).toBe(false);
    expect(crmLastVersionOk([{ returned: false, clientReturned: true }])).toBe(false);
    expect(crmLastVersionOk([{ returned: false, clientReturned: false }])).toBe(true);
  });

  it('crmPlanMonthOk', () => {
    const pkg: CrmPkgView = {
      videos: 2,
      graphics: 4,
      meta: false,
      start: '2026-10',
      months: 6,
      calType: 'специфичен',
    };
    expect(crmPlanMonthOk({ v: 2, g: 4 }, pkg)).toBe(true);
    expect(crmPlanMonthOk({ v: 1, g: 4 }, pkg)).toBe(false);
    expect(crmPlanMonthOk(undefined, pkg)).toBe(false);
  });

  it('crmPkgMissing', () => {
    expect(
      crmPkgMissing({
        videos: 0,
        graphics: 0,
        meta: false,
        start: '',
        months: 0,
        calType: 'специфичен',
      }),
    ).toEqual(['број видеа/графики', 'старт датум', 'должина на договор']);
    expect(
      crmPkgMissing({
        videos: 2,
        graphics: 0,
        meta: false,
        start: '2026-10',
        months: 6,
        calType: 'специфичен',
      }),
    ).toEqual([]);
  });
});
