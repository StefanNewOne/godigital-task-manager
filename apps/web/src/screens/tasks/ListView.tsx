import type React from 'react';
import { useState } from 'react';
import {
  GROUP_STATUS_META,
  ROLE_LABEL,
  ownerOf,
  type ContentType,
  type GroupStatus,
  type TaskStatus,
} from '@gd/core';
import {
  ChevronDown,
  ChevronRight,
  Clapperboard,
  Image as ImageIcon,
  Paperclip,
  Video,
} from 'lucide-react';
import type { CoverageRow } from '../../api/overview.js';
import type { ClientRow, EmployeeRow, TaskGroupRow, TaskListItem } from '../../lib/types.js';
import { deadlineFor, fmtDate, relDate } from '../../lib/tasksView.js';
import { StatusBadge } from '../../components/StatusBadge.js';

const GRID = 'minmax(240px,2.2fr) 104px 190px 172px 104px 56px 60px';

interface ListViewProps {
  tasks: TaskListItem[];
  groups: TaskGroupRow[];
  clientById: Map<string, ClientRow>;
  empById: Map<string, EmployeeRow>;
  coverageById: Map<string, CoverageRow>;
  grouped: boolean;
  compact: boolean;
  openId: string | null;
  onOpen: (id: string) => void;
  onOpenCapa: (id: string) => void;
}

/** Список (Handoff §2.2): капа-лента + sticky табела со групирање и покриеност. */
export function ListView(props: ListViewProps) {
  const { tasks, clientById, grouped, compact, onOpen, openId } = props;
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const groupsByClient = grouped
    ? [...new Set(tasks.map((t) => t.clientId))].map((cid) => ({
        cid,
        rows: tasks.filter((t) => t.clientId === cid),
      }))
    : [{ cid: '', rows: tasks }];

  return (
    <div>
      <CapaStrip {...props} />

      {tasks.length === 0 && (
        <p style={{ color: 'var(--gd-ink-muted)' }}>Нема задачи што одговараат на филтерот.</p>
      )}

      {tasks.length > 0 && (
        <div style={tableWrap}>
          <div style={{ minWidth: '100%', width: 'max-content' }}>
            <div style={headerRow}>
              {[
                'Име',
                'Датум на објава',
                'Статус',
                'Улога и доделен',
                'Датум',
                'Верзија',
                'Прилози',
              ].map((h) => (
                <div key={h} style={th}>
                  {h}
                </div>
              ))}
            </div>
            {groupsByClient.map(({ cid, rows }) => {
              const client = clientById.get(cid);
              const cov = props.coverageById.get(cid);
              const isOpen = !collapsed.has(cid);
              return (
                <div key={cid || 'all'}>
                  {grouped && (
                    <button
                      style={groupHeader}
                      onClick={() =>
                        setCollapsed((c) => {
                          const n = new Set(c);
                          if (n.has(cid)) n.delete(cid);
                          else n.add(cid);
                          return n;
                        })
                      }
                    >
                      {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          background: client?.color ?? '#ccc',
                        }}
                      />
                      <span style={{ fontWeight: 600 }}>{client?.name ?? 'Клиент'}</span>
                      <span style={{ color: 'var(--gd-ink-muted)', fontWeight: 400 }}>
                        · {rows.length}
                      </span>
                      {cov && <CoverageChip cov={cov} />}
                    </button>
                  )}
                  {isOpen &&
                    rows.map((t) => (
                      <Row
                        key={t.id}
                        task={t}
                        client={clientById.get(t.clientId)}
                        empById={props.empById}
                        compact={compact}
                        active={openId === t.id}
                        onOpen={onOpen}
                      />
                    ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Row({
  task,
  client,
  empById,
  compact,
  active,
  onOpen,
}: {
  task: TaskListItem;
  client: ClientRow | undefined;
  empById: Map<string, EmployeeRow>;
  compact: boolean;
  active: boolean;
  onOpen: (id: string) => void;
}) {
  const reserved = task.status === 'mrtov';
  const owner = ownerOf(task.status as TaskStatus, task.contentType as ContentType);
  const assigneeEmp = task.assigneeId ? empById.get(task.assigneeId) : undefined;
  const assignee = assigneeEmp?.name ?? null;
  const dl = deadlineFor(task);
  const TypeIcon = task.contentType === 'video' ? Video : ImageIcon;

  if (reserved) {
    return (
      <button
        style={{ ...dataRow(active, compact), ...reservedRow }}
        onClick={() => onOpen(task.id)}
      >
        <div style={{ ...nameCell, color: 'var(--gd-ink-muted)' }}>
          <span style={{ ...stripe, background: client?.color ?? '#ccc' }} />
          {client?.name ?? 'Клиент'} · резервиран слот · {fmtDate(task.slot?.date)}
        </div>
        <div style={cell} />
        <div style={cell}>
          <StatusBadge status="mrtov" />
        </div>
        <div style={cell} />
        <div style={cell} />
        <div style={cell} />
        <div style={cell} />
      </button>
    );
  }

  return (
    <button style={dataRow(active, compact)} onClick={() => onOpen(task.id)}>
      <div style={nameCell}>
        <span style={{ ...stripe, background: client?.color ?? '#ccc' }} />
        <TypeIcon size={16} color={task.contentType === 'video' ? '#7C3AED' : '#0D9488'} />
        <span style={ellipsis}>{task.title}</span>
        {task.priority === 'iten' && <span style={{ color: 'var(--gd-danger)' }}>▲</span>}
      </div>
      <div style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>{fmtDate(task.slot?.date)}</div>
      <div style={cell}>
        <StatusBadge status={task.status} />
      </div>
      <div
        style={{
          ...cell,
          color: 'var(--gd-ink-secondary)',
          fontSize: 13,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {assigneeEmp ? (
          <span style={rowAvatar(assigneeEmp.color)}>{avatarInitials(assigneeEmp.name)}</span>
        ) : (
          <span style={rowAvatarEmpty} />
        )}
        <span style={ellipsis}>
          {owner ? ROLE_LABEL[owner] : '—'} · {assignee ?? 'Недоделен'}
        </span>
      </div>
      <div style={{ ...cell, fontSize: 13, color: dl ? dlColor(dl.level) : 'var(--gd-ink-muted)' }}>
        {dl ? relDate(task.slot?.date) : '—'}
      </div>
      <div style={{ ...cell, fontVariantNumeric: 'tabular-nums' }}>
        {task.version > 1 ? `v.${task.version}` : ''}
      </div>
      <div style={{ ...cell, color: 'var(--gd-ink-muted)' }}>
        {task._count.publications > 0 && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <Paperclip size={12} /> {task._count.publications}
          </span>
        )}
      </div>
    </button>
  );
}

const CAPA_MONTHS = [
  'Јануари',
  'Февруари',
  'Март',
  'Април',
  'Мај',
  'Јуни',
  'Јули',
  'Август',
  'Септември',
  'Октомври',
  'Ноември',
  'Декември',
];

function CapaStrip({ groups, clientById, empById, onOpenCapa }: ListViewProps) {
  // Само активни капи (претпродукција) се прикажуваат како картички; затворените се скриени (Handoff).
  const active = groups.filter((g) => g.status !== 'zatvoren');
  if (active.length === 0) return null;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={capaStripHead}>Капа таскови · {active.length}</div>
      <div style={active.length > 1 ? capaGrid : undefined}>
        {active.map((g) => {
          const client = clientById.get(g.clientId);
          const meta = GROUP_STATUS_META[g.status as GroupStatus];
          const ownerId =
            meta?.owner === 'kam' ? g.kamId : meta?.owner === 'rez' ? g.rezId : g.scenaristId;
          const ownerName = ownerId ? empById.get(ownerId)?.name : null;
          const total = g.scenariosTotal || g.plannedCount;
          const [yy, mm] = g.monthKey.split('-');
          const monthLabel = `${CAPA_MONTHS[Number(mm) - 1] ?? mm} ${yy}`;
          return (
            <button key={g.id} style={capaBanner} onClick={() => onOpenCapa(g.id)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Clapperboard size={16} color="var(--gd-primary)" />
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: client?.color ?? '#ccc',
                    flex: '0 0 auto',
                  }}
                />
                <strong style={{ fontSize: 14 }}>{client?.name}</strong>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}>
                <span style={{ fontSize: 13, color: 'var(--gd-ink-secondary)' }}>
                  {g.contentType === 'video' ? 'Видео' : 'Графика'} · {monthLabel}
                </span>
                <span style={capaChip}>{meta?.label ?? g.status}</span>
              </div>
              <div style={{ fontSize: 13, color: 'var(--gd-ink-secondary)' }}>
                {g.contentType === 'video'
                  ? `${g.scenariosApproved} од ${total} сценарија одобрени${ownerName ? ` · кај ${ownerName}` : ''}`
                  : `${g.plannedCount} слота во пакетот`}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CoverageChip({ cov }: { cov: CoverageRow }) {
  const clr = cov.level === 'danger' ? '#DC2626' : cov.level === 'warn' ? '#D97706' : '#16A34A';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        marginLeft: 8,
        fontSize: 12,
        color: 'var(--gd-ink-muted)',
        fontWeight: 400,
      }}
    >
      <span style={{ width: 24, height: 4, borderRadius: 2, background: clr }} />
      покриеност {cov.days} {cov.days === 1 ? 'ден' : 'дена'}
    </span>
  );
}

const dlColor = (l: string) =>
  l === 'overdue' ? 'var(--gd-danger)' : l === 'soon' ? 'var(--gd-warning)' : 'var(--gd-ink-muted)';

function avatarInitials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}
const rowAvatar = (bg: string): React.CSSProperties => ({
  width: 24,
  height: 24,
  borderRadius: '50%',
  background: bg,
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 600,
  flex: '0 0 auto',
});
const rowAvatarEmpty: React.CSSProperties = {
  width: 24,
  height: 24,
  borderRadius: '50%',
  background: 'var(--gd-surface-alt)',
  border: '1px solid var(--gd-border)',
  flex: '0 0 auto',
};

const tableWrap: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  background: 'var(--gd-surface)',
  overflow: 'auto',
  maxHeight: 'calc(100vh - 220px)',
};
const headerRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: GRID,
  gap: 12,
  padding: '0 16px',
  position: 'sticky',
  top: 0,
  background: 'var(--gd-surface-alt)',
  borderBottom: '1px solid var(--gd-border)',
  zIndex: 1,
};
const th: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--gd-ink-muted)',
  padding: '8px 0',
};
const groupHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '10px 16px',
  border: 'none',
  borderBottom: '1px solid var(--gd-border)',
  background: 'var(--gd-surface-alt)',
  fontSize: 14,
  cursor: 'pointer',
};
const dataRow = (active: boolean, compact: boolean): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: GRID,
  gap: 12,
  alignItems: 'center',
  width: '100%',
  height: compact ? 32 : 44,
  padding: '0 16px',
  border: 'none',
  borderLeft: active ? '2px solid var(--gd-primary)' : '2px solid transparent',
  borderBottom: '1px solid var(--gd-border)',
  background: active ? 'var(--gd-primary-tint)' : 'transparent',
  cursor: 'pointer',
  textAlign: 'left',
});
const reservedRow: React.CSSProperties = { borderBottom: '1px dashed var(--gd-danger)' };
const cell: React.CSSProperties = { minWidth: 0, overflow: 'hidden' };
const nameCell: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 0,
  fontSize: 14,
  fontWeight: 500,
};
const stripe: React.CSSProperties = { width: 3, height: 24, borderRadius: 2, flex: '0 0 auto' };
const ellipsis: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};
const capaStripHead: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--gd-ink-secondary)',
  marginBottom: 8,
};
const capaGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: 12,
};
const capaBanner: React.CSSProperties = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  border: '1px solid var(--gd-primary-border)',
  background: 'var(--gd-primary-wash)',
  borderRadius: 8,
  padding: 16,
  marginBottom: 16,
  cursor: 'pointer',
};
const capaChip: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 500,
  padding: '2px 8px',
  borderRadius: 4,
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-border)',
  color: 'var(--gd-ink-secondary)',
};
