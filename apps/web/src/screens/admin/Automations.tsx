import type React from 'react';
import {
  DEFAULT_GROUP_LEAD_DAYS,
  DEFAULT_TASK_LEAD_DAYS,
  GROUP_STATUS_META,
  GROUP_TRANSITIONS,
  ROLE_LABEL,
  TASK_STATUS_META,
  TASK_TRANSITIONS,
  ownerOf,
  type ContentType,
  type GroupStatus,
  type Role,
  type TaskStatus,
} from '@gd/core';
import { t } from '@gd/ui';
import { tableStyles as s } from '../../components/table.js';

/**
 * Админ → Автоматизации (PRD §4.3 / Handoff): read-only тек на статуси по тип.
 * Изворот е state machine матрицата во `@gd/core` — истата што ја вози API-то,
 * Board DnD и ботот (CLAUDE.md §3 златно правило). Ниту еден статус не е hardcoded тука.
 */
export function AdminAutomations() {
  return (
    <div>
      <p style={{ color: 'var(--gd-ink-muted)', fontSize: 13, marginTop: -8, marginBottom: 20 }}>
        {t('automations.intro')}
      </p>

      <FlowTable title={t('automations.titleVideoCapa')} rows={groupRows('video')} />
      <FlowTable title={t('automations.titleVideoTask')} rows={taskRows('video')} />
      <FlowTable title={t('automations.titleGraphicCapa')} rows={groupRows('graphic')} />
      <FlowTable title={t('automations.titleGraphicTask')} rows={taskRows('graphic')} />
    </div>
  );
}

interface FlowRow {
  status: string;
  owner: string;
  input: string;
  deadline: string;
  next: string;
  back: string;
}

function FlowTable({ title, rows }: { title: string; rows: FlowRow[] }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>{title}</h2>
      <div style={s.wrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>{t('automations.colStatus')}</th>
              <th style={s.th}>{t('automations.colOwner')}</th>
              <th style={s.th}>{t('automations.colInput')}</th>
              <th style={s.th}>{t('automations.colDeadline')}</th>
              <th style={s.th}>{t('automations.colNext')}</th>
              <th style={s.th}>{t('automations.colBack')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.status}>
                <td style={{ ...s.td, fontWeight: 500 }}>{r.status}</td>
                <td style={s.td}>{r.owner}</td>
                <td style={{ ...s.td, color: 'var(--gd-ink-secondary)', fontSize: 13 }}>
                  {r.input}
                </td>
                <td style={{ ...s.td, fontSize: 13 }}>{r.deadline}</td>
                <td style={{ ...s.td, color: 'var(--gd-ink-secondary)' }}>{r.next}</td>
                <td style={{ ...s.td, color: 'var(--gd-warning-text)', fontSize: 13 }}>{r.back}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ── Редови по тип, изведени од матрицата ──

const VIDEO_TASK_FLOW: TaskStatus[] = [
  'mrtov',
  'cekaSnimanje',
  'chekaRezija',
  'montaza',
  'vnatresno',
  'kajKlient',
  'zaObjavuvanje',
  'objaveno',
  'analitika',
  'zavrseno',
];
const GRAPHIC_TASK_FLOW: TaskStatus[] = [
  'mrtov',
  'brifing',
  'dizajn',
  'vnatresno',
  'kajKlient',
  'zaObjavuvanje',
  'objaveno',
  'analitika',
  'zavrseno',
];
const VIDEO_CAPA_FLOW: GroupStatus[] = [
  'podgotovka',
  'scenarija',
  'scenKajKlient',
  'snimanje',
  'zatvoren',
];
const GRAPHIC_CAPA_FLOW: GroupStatus[] = ['gPodgotovka', 'zatvoren'];

function taskRows(type: ContentType): FlowRow[] {
  const flow = type === 'video' ? VIDEO_TASK_FLOW : GRAPHIC_TASK_FLOW;
  return flow.map((status, i) => {
    const fwd = TASK_TRANSITIONS.find(
      (t) =>
        t.from === status &&
        (t.contentType === 'both' || t.contentType === type) &&
        flow.indexOf(t.to) > i,
    );
    const lead = DEFAULT_TASK_LEAD_DAYS[type][status];
    const back = TASK_TRANSITIONS.find(
      (t) =>
        t.from === status &&
        (t.contentType === 'both' || t.contentType === type) &&
        flow.indexOf(t.to) >= 0 &&
        flow.indexOf(t.to) < i,
    );
    return {
      status: TASK_STATUS_META[status].label,
      owner:
        fwd?.actor === 'system' ? t('automations.systemAuto') : ownerLabel(ownerOf(status, type)),
      input: fwd ? describeGuards(fwd.guards) : '—',
      deadline: taskDeadlineText(lead),
      next: fwd ? TASK_STATUS_META[fwd.to].label : t('automations.terminal'),
      back: back ? `↩ ${TASK_STATUS_META[back.to].label}` : '—',
    };
  });
}

function groupRows(type: ContentType): FlowRow[] {
  const flow = type === 'video' ? VIDEO_CAPA_FLOW : GRAPHIC_CAPA_FLOW;
  return flow.map((status, i) => {
    const fwd = GROUP_TRANSITIONS.find(
      (t) => t.from === status && t.contentType === type && flow.indexOf(t.to) > i,
    );
    const owner = GROUP_STATUS_META[status].owner;
    const lead = DEFAULT_GROUP_LEAD_DAYS[status];
    const back = GROUP_TRANSITIONS.find(
      (t) =>
        t.from === status &&
        t.contentType === type &&
        flow.indexOf(t.to) >= 0 &&
        flow.indexOf(t.to) < i,
    );
    return {
      status: GROUP_STATUS_META[status].label,
      owner:
        fwd?.actor === 'system' || owner === 'system'
          ? t('automations.systemAuto')
          : ownerLabel(owner),
      input: fwd ? describeGuards(fwd.guards) : '—',
      deadline: capaDeadlineText(lead),
      next: fwd ? GROUP_STATUS_META[fwd.to].label : t('automations.closed'),
      back: back ? `↩ ${GROUP_STATUS_META[back.to].label}` : '—',
    };
  });
}

function ownerLabel(role: Role | null): string {
  return role ? ROLE_LABEL[role] : '—';
}

function taskDeadlineText(lead: number | undefined): string {
  if (lead === undefined) return '—';
  if (lead === 0) return t('automations.dlOnPublish');
  return lead > 0
    ? t('automations.dlBeforePublish', { n: lead })
    : t('automations.dlAfterPublish', { n: Math.abs(lead) });
}

function capaDeadlineText(lead: number | undefined): string {
  if (lead === undefined) return '—';
  return lead === 0 ? t('automations.dlOnShoot') : t('automations.dlBeforeShoot', { n: lead });
}

/** Преведи ги declarative guard токените во македонски опис на задолжителниот внес. */
function describeGuards(guards: readonly string[]): string {
  const parts: string[] = [];
  for (const g of guards) {
    const name = g.split('(')[0];
    const args = (g.match(/\(([^)]*)\)/)?.[1] ?? '').split(',');
    switch (name) {
      case 'G_ASSIGNEE_REQUIRED':
        parts.push(t('automations.gAssignee', { role: roleWord(args[0]) }));
        break;
      case 'G_TEXT':
        parts.push(
          args[0] === 'brief'
            ? t('automations.gBrief')
            : args[0] === 'copy'
              ? t('automations.gCopy')
              : (args[0] ?? t('automations.gText')),
        );
        break;
      case 'G_FILE':
        parts.push(FILE_LABEL[args[0] ?? ''] ?? t('automations.flGraphic'));
        break;
      case 'G_PUBLICATION':
        parts.push(t('automations.gPublication'));
        break;
      case 'G_COMMENT':
        parts.push(t('automations.gComment'));
        break;
      case 'G_COMMENT_IF_CHANGES':
        parts.push(t('automations.gCommentIfChanges'));
        break;
      case 'G_CLIENT_OUTCOME':
        parts.push(t('automations.gClientOutcome'));
        break;
      case 'G_DECISION':
        parts.push(t('automations.gDecision'));
        break;
      case 'G_CAPA_FIELDS':
        parts.push(t('automations.gCapaFields'));
        break;
      case 'G_SCENARIOS_SPLIT':
        parts.push(t('automations.gScenariosSplit'));
        break;
      case 'G_SCENARIO_OUTCOMES':
        parts.push(t('automations.gScenarioOutcomes'));
        break;
      case 'G_AT_LEAST_ONE_APPROVED':
        parts.push(t('automations.gAtLeastOneApproved'));
        break;
      // G_NOT_SELF_APPROVAL и системските услови не се внес од корисник.
      default:
        break;
    }
  }
  return parts.length ? parts.join(', ') : t('automations.gAuto');
}

const FILE_LABEL: Record<string, string> = {
  final: t('automations.flFinal'),
  graphic: t('automations.flGraphic'),
  raw: t('automations.flRaw'),
  scenarioDoc: t('automations.flScenarioDoc'),
};

function roleWord(code: string | undefined): string {
  const label = code ? ROLE_LABEL[code as Role] : undefined;
  return label ? label.toLowerCase() : (code ?? '');
}
