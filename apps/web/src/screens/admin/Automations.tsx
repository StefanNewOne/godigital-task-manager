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
import { tableStyles as s } from '../../components/table.js';

/**
 * Админ → Автоматизации (PRD §4.3 / Handoff): read-only тек на статуси по тип.
 * Изворот е state machine матрицата во `@gd/core` — истата што ја вози API-то,
 * Board DnD и ботот (CLAUDE.md §3 златно правило). Ниту еден статус не е hardcoded тука.
 */
export function AdminAutomations() {
  return (
    <div>
      <h1 style={s.h1}>Автоматизации · тек на статуси</h1>
      <p style={{ color: 'var(--gd-ink-muted)', fontSize: 13, marginTop: -8, marginBottom: 20 }}>
        Читливо. Секој статус го носи точно една улога; преодот се пушта само кога задолжителниот
        внес е даден. Изворот е матрицата на преоди во <code>@gd/core</code>.
      </p>

      <FlowTable title="Видео · капа таск" rows={groupRows('video')} />
      <FlowTable title="Видео · таск" rows={taskRows('video')} />
      <FlowTable title="Графика · капа таск" rows={groupRows('graphic')} />
      <FlowTable title="Графика · таск" rows={taskRows('graphic')} />
    </div>
  );
}

interface FlowRow {
  status: string;
  owner: string;
  input: string;
  deadline: string;
  next: string;
}

function FlowTable({ title, rows }: { title: string; rows: FlowRow[] }) {
  return (
    <section style={{ marginBottom: 24 }}>
      <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 8px' }}>{title}</h2>
      <div style={s.wrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Статус</th>
              <th style={s.th}>Кој го носи</th>
              <th style={s.th}>Што мора да се внесе</th>
              <th style={s.th}>Внатрешен рок</th>
              <th style={s.th}>Следен статус</th>
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
    return {
      status: TASK_STATUS_META[status].label,
      owner: fwd?.actor === 'system' ? 'систем (автоматски)' : ownerLabel(ownerOf(status, type)),
      input: fwd ? describeGuards(fwd.guards) : '—',
      deadline: taskDeadlineText(lead),
      next: fwd ? TASK_STATUS_META[fwd.to].label : '— (терминал)',
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
    return {
      status: GROUP_STATUS_META[status].label,
      owner:
        fwd?.actor === 'system' || owner === 'system' ? 'систем (автоматски)' : ownerLabel(owner),
      input: fwd ? describeGuards(fwd.guards) : '—',
      deadline: capaDeadlineText(lead),
      next: fwd ? GROUP_STATUS_META[fwd.to].label : '— (затворена)',
    };
  });
}

function ownerLabel(role: Role | null): string {
  return role ? ROLE_LABEL[role] : '—';
}

function taskDeadlineText(lead: number | undefined): string {
  if (lead === undefined) return '—';
  if (lead === 0) return 'на денот на објава';
  return lead > 0 ? `${lead} дена пред објава` : `${Math.abs(lead)} дена по објава`;
}

function capaDeadlineText(lead: number | undefined): string {
  if (lead === undefined) return '—';
  return lead === 0 ? 'на денот на снимање' : `${lead} дена пред снимање`;
}

/** Преведи ги declarative guard токените во македонски опис на задолжителниот внес. */
function describeGuards(guards: readonly string[]): string {
  const parts: string[] = [];
  for (const g of guards) {
    const name = g.split('(')[0];
    const args = (g.match(/\(([^)]*)\)/)?.[1] ?? '').split(',');
    switch (name) {
      case 'G_ASSIGNEE_REQUIRED':
        parts.push(`доделен ${roleWord(args[0])}`);
        break;
      case 'G_TEXT':
        parts.push(
          args[0] === 'brief'
            ? 'брифинг (≥ 50 знаци)'
            : args[0] === 'copy'
              ? 'копи текст'
              : (args[0] ?? 'текст'),
        );
        break;
      case 'G_FILE':
        parts.push(FILE_LABEL[args[0] ?? ''] ?? 'фајл');
        break;
      case 'G_PUBLICATION':
        parts.push('линк до објава');
        break;
      case 'G_COMMENT':
        parts.push('коментар');
        break;
      case 'G_COMMENT_IF_CHANGES':
        parts.push('коментар (при измени)');
        break;
      case 'G_CLIENT_OUTCOME':
        parts.push('исход од клиент');
        break;
      case 'G_DECISION':
        parts.push('одлука: органски/платено');
        break;
      case 'G_CAPA_FIELDS':
        parts.push('сценарист, датум, час, место');
        break;
      case 'G_SCENARIOS_SPLIT':
        parts.push('поделени сценарија');
        break;
      case 'G_SCENARIO_OUTCOMES':
        parts.push('исход по сценарио');
        break;
      case 'G_AT_LEAST_ONE_APPROVED':
        parts.push('барем едно одобрено сценарио');
        break;
      // G_NOT_SELF_APPROVAL и системските услови не се внес од корисник.
      default:
        break;
    }
  }
  return parts.length ? parts.join(', ') : '— (автоматски)';
}

const FILE_LABEL: Record<string, string> = {
  final: 'финално видео',
  graphic: 'графика',
  raw: 'суров материјал',
  scenarioDoc: 'документ со сценарија',
};

function roleWord(code: string | undefined): string {
  const label = code ? ROLE_LABEL[code as Role] : undefined;
  return label ? label.toLowerCase() : (code ?? '');
}
