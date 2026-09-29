import { OP_CODES, opMeta, type OpCode } from '@gd/core';
import { searchKnowledge } from '../knowledge/search.js';
import { listMetaAlerts, metaClientStructure, metaCross, metaOverview } from './read.js';
import { previewPlan } from './plans.js';

/**
 * Модул 3 · Мета — AI помошник (§11). Посебен чат во Мета. Само алатки за ЧИТАЊЕ (преку внатрешен
 * API, никогаш директно кон Meta) + `draft_plan` што враќа preview но НЕ создава `MetaChangePlan`.
 * Корисникот потоа кликнува „Отвори како план" / „Прати на одобрување" (истиот модал, `via=assistant`).
 *
 * Прототипот користи клучни зборови за намера; продукцијата Claude tool-use. Детерминистичкиот
 * engine е стандардот (dev/тест/CI); Claude се вклучува преку `CLAUDE_MODE` во иднина.
 */

export interface PlanDraft {
  op: OpCode;
  clientId: string;
  target: { campaignId?: string; adSetId?: string; adId?: string };
  params: Record<string, unknown>;
  before: Record<string, unknown>;
  after: Record<string, unknown> | null;
  consequences: string[];
  warnings: string[];
  command: string;
}

export interface MetaChatResult {
  answer: string;
  draft: PlanDraft | null;
  /** Планот е одбиен зашто рекламната сметка е само за читање (§11). */
  refused: boolean;
  toolsUsed: string[];
}

export interface MetaChatInput {
  message: string;
  clientId?: string;
  actorRole: string;
}

const NUM = /(\d+(?:[.,]\d+)?)/;

function parseAmount(text: string): number | null {
  const m = text.match(NUM);
  if (!m) return null;
  return Number(m[1]!.replace(',', '.'));
}

/** Детерминистичка намера од македонски клучни зборови (прототип §11). */
function detectIntent(msg: string): {
  tool: 'draft_plan' | 'get_alerts' | 'get_overview' | 'get_cross' | 'get_structure' | 'search';
  op?: OpCode;
  params?: Record<string, unknown>;
} {
  const m = msg.toLowerCase();
  if (m.includes('буџет')) return { tool: 'draft_plan', op: 'O2' };
  if (m.includes('пауз')) return { tool: 'draft_plan', op: 'O1', params: { status: 'PAUSED' } };
  if (m.includes('активир')) return { tool: 'draft_plan', op: 'O1', params: { status: 'ACTIVE' } };
  if (m.includes('преимен')) return { tool: 'draft_plan', op: 'O11' };
  if (m.includes('алерт') || m.includes('проблем') || m.includes('предупред'))
    return { tool: 'get_alerts' };
  if (m.includes('пресек') || m.includes('споредб')) return { tool: 'get_cross' };
  if (m.includes('структур') || m.includes('кампањи')) return { tool: 'get_structure' };
  if (m.includes('преглед') || m.includes('состојб') || m.includes('утрин') || m.includes('вкупно'))
    return { tool: 'get_overview' };
  return { tool: 'search' };
}

const NO_CLIENT = 'Прво избери клиент во левиот панел за да подготвам план.';

/** Изврши го чатот (детерминистички engine). */
export async function metaAssistantChat(input: MetaChatInput): Promise<MetaChatResult> {
  const intent = detectIntent(input.message);
  const toolsUsed: string[] = [];

  if (intent.tool === 'draft_plan') {
    const op = intent.op!;
    if (!input.clientId) {
      return { answer: NO_CLIENT, draft: null, refused: false, toolsUsed };
    }
    const params: Record<string, unknown> = { ...(intent.params ?? {}) };
    if (op === 'O2') {
      const amount = parseAmount(input.message);
      if (amount == null) {
        return {
          answer: 'Кажи ми точен дневен буџет (на пр. „буџет 200").',
          draft: null,
          refused: false,
          toolsUsed,
        };
      }
      params.amount = amount;
    }
    toolsUsed.push('draft_plan');
    const preview = await previewPlan({ clientId: input.clientId, op, target: {}, params });
    if (preview.accountReadOnly) {
      return {
        answer:
          'Рекламната сметка на овој клиент е само за читање — не можам да подготвам план за промена.',
        draft: null,
        refused: true,
        toolsUsed,
      };
    }
    const draft: PlanDraft = {
      op,
      clientId: input.clientId,
      target: {},
      params,
      before: preview.before,
      after: preview.after,
      consequences: preview.consequences,
      warnings: preview.warnings,
      command: input.message,
    };
    const warn = preview.warnings.length ? ` ⚠ ${preview.warnings.join(' · ')}` : '';
    return {
      answer: `Подготвив нацрт: „${opMeta(op).label}". ${preview.consequences.join(' · ')}${warn} Кликни за да го отвориш како план.`,
      draft,
      refused: false,
      toolsUsed,
    };
  }

  if (intent.tool === 'get_alerts') {
    toolsUsed.push('get_alerts');
    const alerts = await listMetaAlerts({ clientId: input.clientId });
    if (alerts.length === 0) {
      return { answer: 'Нема отворени алерти.', draft: null, refused: false, toolsUsed };
    }
    const top = alerts
      .slice(0, 5)
      .map((a) => `• ${a.title}${a.detail ? ` — ${a.detail}` : ''}`)
      .join('\n');
    return {
      answer: `Отворени алерти (${alerts.length}):\n${top}`,
      draft: null,
      refused: false,
      toolsUsed,
    };
  }

  if (intent.tool === 'get_overview') {
    toolsUsed.push('get_overview');
    const ov = await metaOverview();
    return {
      answer: `Активни кампањи: ${ov.kpi.activeCampaigns} · потрошено денес: €${ov.kpi.todaySpend} · отворени алерти: ${ov.alerts.total} · ${ov.sync.accounts} акаунти.`,
      draft: null,
      refused: false,
      toolsUsed,
    };
  }

  if (intent.tool === 'get_cross') {
    toolsUsed.push('get_cross');
    const cross = await metaCross('7');
    if (cross.groups.length === 0) {
      return {
        answer: 'Нема податоци за пресек за периодот.',
        draft: null,
        refused: false,
        toolsUsed,
      };
    }
    const lines = cross.groups
      .map((g) => `• ${g.objectiveLabel}: €${g.spend} · ${g.results} рез.`)
      .join('\n');
    return {
      answer: `Пресек (7 дена), по Objective (не се собира различно):\n${lines}`,
      draft: null,
      refused: false,
      toolsUsed,
    };
  }

  if (intent.tool === 'get_structure') {
    if (!input.clientId) {
      return {
        answer: 'Избери клиент за да ти ја покажам структурата на кампањите.',
        draft: null,
        refused: false,
        toolsUsed,
      };
    }
    toolsUsed.push('get_client_structure');
    const st = await metaClientStructure(input.clientId, '7');
    return {
      answer: `Клиентот има ${st.campaigns.length} кампањи (7 дена). Отвори „Клиенти → структура" за детали.`,
      draft: null,
      refused: false,
      toolsUsed,
    };
  }

  // search_knowledge fallback
  toolsUsed.push('search_knowledge');
  const hits = await searchKnowledge(input.message, { clientId: input.clientId, limit: 3 });
  if (hits.length === 0) {
    return {
      answer:
        'Не разбрав што бараш. Можам да покажам преглед, алерти, пресек, структура — или да подготвам план (буџет, пауза, преименување).',
      draft: null,
      refused: false,
      toolsUsed,
    };
  }
  return {
    answer: hits.map((h, i) => `[${i + 1}] ${h.text}`).join('\n'),
    draft: null,
    refused: false,
    toolsUsed,
  };
}

/** Достапни операции за помошникот (за UI hint). */
export const ASSISTANT_OPS = OP_CODES;
