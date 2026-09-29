import { describe, expect, it } from 'vitest';
import {
  ALERT_CATALOG,
  ALERT_CODES,
  OBJECTIVE_KEYS,
  OBJECTIVE_MAP,
  OP_CATALOG,
  OP_CODES,
  PLAN_STATUSES,
  PLAN_TRANSITIONS,
  alertDedupeKey,
  alertMeta,
  allowedPlanTargets,
  canAggregate,
  compareAlertSeverity,
  costPerResult,
  findPlanTransition,
  groupByObjective,
  hasMetaAccess,
  isPlanTerminal,
  metaAccess,
  metaCanSeeView,
  objectiveHasRoas,
  objectiveMeta,
  opMeta,
  roas,
  type ObjectiveKey,
} from './index.js';

describe('Meta · Objective мапа (§10)', () => {
  it('секој Objective клуч има мета', () => {
    for (const k of OBJECTIVE_KEYS) {
      expect(OBJECTIVE_MAP[k].objective.length).toBeGreaterThan(0);
      expect(objectiveMeta(k)).toBe(OBJECTIVE_MAP[k]);
    }
  });

  it('ROAS само кај продажби (buy), никогаш кај пораки', () => {
    expect(objectiveHasRoas('buy')).toBe(true);
    expect(objectiveHasRoas('msg')).toBe(false);
    expect(roas('buy', 1000, 200)).toBe(5);
    expect(roas('msg', 1000, 200)).toBeNull();
    expect(roas('buy', 1000, 0)).toBeNull();
  });

  it('canAggregate: само ист Objective; празно = не', () => {
    expect(canAggregate([])).toBe(false);
    expect(canAggregate(['msg', 'msg'])).toBe(true);
    expect(canAggregate(['msg', 'buy'])).toBe(false);
  });

  it('costPerResult: null при 0 резултати', () => {
    expect(costPerResult(100, 0)).toBeNull();
    expect(costPerResult(100, 4)).toBe(25);
  });

  it('groupByObjective групира по клуч', () => {
    const items = [
      { id: 1, o: 'msg' as ObjectiveKey },
      { id: 2, o: 'buy' as ObjectiveKey },
      { id: 3, o: 'msg' as ObjectiveKey },
    ];
    const g = groupByObjective(items, (i) => i.o);
    expect(g.get('msg')).toHaveLength(2);
    expect(g.get('buy')).toHaveLength(1);
  });
});

describe('Meta · алерти (§13)', () => {
  it('секој код има мета, 13 вкупно', () => {
    expect(ALERT_CODES).toHaveLength(13);
    for (const c of ALERT_CODES) {
      expect(ALERT_CATALOG[c].title.length).toBeGreaterThan(0);
      expect(alertMeta(c)).toBe(ALERT_CATALOG[c]);
    }
  });

  it('крит алерти: A01–A04, A12', () => {
    for (const c of ['A01', 'A02', 'A03', 'A04', 'A12'] as const) {
      expect(ALERT_CATALOG[c].severity).toBe('crit');
    }
  });

  it('dedupeKey со и без objectMetaId', () => {
    expect(alertDedupeKey('A01', 'act_123')).toBe('A01:act_123');
    expect(alertDedupeKey('A02', null)).toBe('A02:account');
  });

  it('compareAlertSeverity: crit пред info', () => {
    expect(compareAlertSeverity('crit', 'info')).toBeLessThan(0);
    expect(compareAlertSeverity('mid', 'mid')).toBe(0);
  });
});

describe('Meta · операции O1–O12 (§12)', () => {
  it('12 операции, секоја со ниво + етикета', () => {
    expect(OP_CODES).toHaveLength(12);
    for (const c of OP_CODES) {
      expect(OP_CATALOG[c].label.length).toBeGreaterThan(0);
      expect(opMeta(c)).toBe(OP_CATALOG[c]);
    }
    expect(OP_CATALOG.O4.level).toBe('adset');
    expect(OP_CATALOG.O8.level).toBe('account');
  });
});

describe('Meta · план state machine (§12)', () => {
  it('7 статуси', () => {
    expect(PLAN_STATUSES).toHaveLength(7);
  });

  it('преоди: одобри/одбие/повлечи/направено/потврди/несовпаѓање', () => {
    expect(findPlanTransition('pending', 'approved')?.actor).toBe('dir');
    expect(findPlanTransition('pending', 'rejected')?.requiresNote).toBe(true);
    expect(findPlanTransition('pending', 'withdrawn')?.ownerOnly).toBe(true);
    expect(findPlanTransition('approved', 'syncing')?.actor).toBe('dir');
    expect(findPlanTransition('syncing', 'done')?.actor).toBe('system');
    expect(findPlanTransition('syncing', 'mismatch')?.actor).toBe('system');
    expect(findPlanTransition('done', 'approved')).toBeUndefined();
  });

  it('allowedPlanTargets + терминали', () => {
    expect(allowedPlanTargets('pending').sort()).toEqual(['approved', 'rejected', 'withdrawn']);
    expect(allowedPlanTargets('syncing').sort()).toEqual(['done', 'mismatch']);
    expect(isPlanTerminal('done')).toBe(true);
    expect(isPlanTerminal('mismatch')).toBe(true);
    expect(isPlanTerminal('pending')).toBe(false);
  });

  it('sync (system) не бара белешка', () => {
    for (const t of PLAN_TRANSITIONS.filter((x) => x.actor === 'system')) {
      expect(t.requiresNote).toBe(false);
    }
  });
});

describe('Meta · пристап по улога (§3)', () => {
  it('dir: сè; ana: без одобрување + само свои планови; am: само inbox/comments', () => {
    expect(metaAccess('dir')?.canApprovePlan).toBe(true);
    expect(metaAccess('dir')?.planAutoApproved).toBe(true);
    expect(metaAccess('ana')?.canProposePlan).toBe(true);
    expect(metaAccess('ana')?.canApprovePlan).toBe(false);
    expect(metaAccess('ana')?.seesOwnPlansOnly).toBe(true);
    expect(metaAccess('am')?.views).toEqual(['inbox', 'comments']);
    expect(metaAccess('am')?.canProposePlan).toBe(false);
  });

  it('hasMetaAccess: dir/ana/am да, другите не', () => {
    expect(hasMetaAccess('dir')).toBe(true);
    expect(hasMetaAccess('ana')).toBe(true);
    expect(hasMetaAccess('am')).toBe(true);
    expect(hasMetaAccess('rez')).toBe(false);
    expect(hasMetaAccess('sales')).toBe(false);
  });

  it('metaCanSeeView: am само inbox/comments; dir планови', () => {
    expect(metaCanSeeView('am', 'inbox')).toBe(true);
    expect(metaCanSeeView('am', 'comments')).toBe(true);
    expect(metaCanSeeView('am', 'plans')).toBe(false);
    expect(metaCanSeeView('dir', 'plans')).toBe(true);
    expect(metaCanSeeView('rez', 'overview')).toBe(false);
  });
});
