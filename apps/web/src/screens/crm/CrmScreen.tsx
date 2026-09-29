import type React from 'react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  CRM_FLOW,
  CRM_STALE_DAYS,
  CRM_STATUS_META,
  crmForwardTarget,
  isCrmBoardDraggable,
  type CrmStatus,
} from '@gd/core';
import { useMe } from '../../api/auth.js';
import {
  useCrmAgents,
  useLeadTransition,
  useLeads,
  type CrmFilter,
  type LeadRow,
} from '../../api/crm.js';
import { ApiRequestError } from '../../lib/api.js';
import { LeadPanel } from './LeadPanel.js';
import { NewLeadModal } from './NewLeadModal.js';

type CrmView = 'crm' | 'crmApprove' | 'crmLost';

/** Дали тековната улога смее да дејствува на лидот (ADDENDUM). */
export function canActOnLead(lead: LeadRow, me: { id: string; role: string }): boolean {
  const meta = CRM_STATUS_META[lead.status];
  if (lead.status === 'izguben') return me.id === lead.agentId || me.role === 'dir';
  if (meta.owner === 'dir') return me.role === 'dir';
  if (meta.owner === 'agent') return me.id === lead.agentId;
  return false;
}

export function CrmScreen() {
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();
  const view = (params.get('view') as CrmView | null) ?? 'crm';
  const filter = (params.get('filter') as CrmFilter | null) ?? 'all';
  const agentParam = params.get('agent') ?? '';
  const isDir = me?.role === 'dir';

  const { data: leads = [] } = useLeads(filter, isDir ? agentParam || undefined : undefined);
  const { data: agents = [] } = useCrmAgents();
  const [openLead, setOpenLead] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);

  const setView = (v: CrmView) => {
    const next = new URLSearchParams(params);
    next.set('view', v);
    setParams(next);
  };
  const setFilter = (f: CrmFilter) => {
    const next = new URLSearchParams(params);
    if (f === 'all') next.delete('filter');
    else next.set('filter', f);
    setParams(next);
  };
  const setAgent = (id: string) => {
    const next = new URLSearchParams(params);
    if (id) next.set('agent', id);
    else next.delete('agent');
    setParams(next);
  };

  const active = leads.filter((l) => l.status !== 'izguben' && l.status !== 'aktiviran');
  const nWaiting = active.filter((l) => l.waitDir).length;
  const nStale = active.filter((l) => l.isStale).length;
  const summary = `${active.length} активни · ${nWaiting} чекаат директор · ${nStale} без промена ${CRM_STALE_DAYS}+ дена`;

  if (!me) return null;

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      {/* Лев контекст-панел (240px) */}
      <aside style={rail}>
        <div style={railTitle}>{isDir ? 'Pipeline' : 'Мои лидови'}</div>
        {(
          [
            ['all', 'Сите активни', active.length],
            ['waiting', 'Чекаат директор', nWaiting],
            ['stale', `Без промена ${CRM_STALE_DAYS}+ дена`, nStale],
          ] as Array<[CrmFilter, string, number]>
        ).map(([k, label, n]) => (
          <button
            key={k}
            type="button"
            onClick={() => {
              setFilter(k);
              setView('crm');
            }}
            style={railItem(view === 'crm' && filter === k)}
          >
            <span>{label}</span>
            <span style={{ color: 'var(--gd-ink-muted)' }}>{n}</span>
          </button>
        ))}
        {isDir && (
          <>
            <div style={{ ...railTitle, marginTop: 16 }}>Продажни агенти</div>
            <button type="button" onClick={() => setAgent('')} style={railItem(!agentParam)}>
              <span>Сите агенти</span>
            </button>
            {agents.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => setAgent(a.id)}
                style={railItem(agentParam === a.id)}
              >
                <span
                  style={{ width: 8, height: 8, borderRadius: '50%', background: a.color }}
                  aria-hidden
                />
                <span>{a.name}</span>
              </button>
            ))}
          </>
        )}
      </aside>

      {/* Главна колона */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header style={topBar}>
          <div style={{ display: 'flex', gap: 4 }}>
            {(
              [
                ['crm', 'Pipeline'],
                ['crmApprove', 'Одобрувања'],
                ['crmLost', 'Изгубени'],
              ] as Array<[CrmView, string]>
            )
              .filter(([v]) => v !== 'crmApprove' || isDir)
              .map(([v, label]) => (
                <button key={v} type="button" onClick={() => setView(v)} style={tab(view === v)}>
                  {label}
                </button>
              ))}
          </div>
          <span style={{ color: 'var(--gd-ink-muted)', fontSize: 13, marginLeft: 12 }}>
            {summary}
          </span>
          <button type="button" onClick={() => setNewOpen(true)} style={primaryBtn}>
            + Нов лид
          </button>
        </header>

        {view === 'crm' && (
          <PipelineBoard leads={leads} me={me} filter={filter} onOpen={setOpenLead} />
        )}
        {view === 'crmApprove' && isDir && <ApproveList leads={leads} onOpen={setOpenLead} />}
        {view === 'crmLost' && <LostList leads={leads} onOpen={setOpenLead} />}
      </div>

      {openLead && (
        <LeadPanel key={openLead} leadId={openLead} me={me} onClose={() => setOpenLead(null)} />
      )}
      {newOpen && (
        <NewLeadModal
          isDir={isDir}
          agents={agents}
          onClose={() => setNewOpen(false)}
          onCreated={(id) => {
            setNewOpen(false);
            setOpenLead(id);
          }}
        />
      )}
    </div>
  );
}

/** Pipeline табла — 11 работни колони + Активирани; DnD само кон следниот чекор. */
function PipelineBoard({
  leads,
  me,
  filter,
  onOpen,
}: {
  leads: LeadRow[];
  me: { id: string; role: string };
  filter: CrmFilter;
  onOpen: (id: string) => void;
}) {
  const [drag, setDrag] = useState<{ id: string; from: CrmStatus } | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const move = useLeadTransition(drag?.id ?? '');

  const shown = leads.filter((l) => {
    if (l.status === 'izguben') return false;
    if (filter === 'waiting') return l.waitDir;
    if (filter === 'stale') return l.isStale;
    return true;
  });

  const columns = useMemo(
    () =>
      [...CRM_FLOW, 'aktiviran' as CrmStatus].map((k) => ({
        key: k,
        meta: CRM_STATUS_META[k],
        cards: shown.filter((l) => l.status === k),
      })),
    [shown],
  );

  const drop = (to: CrmStatus) => {
    setOver(null);
    const d = drag;
    setDrag(null);
    if (!d || d.from === to) return;
    if (!isCrmBoardDraggable(d.from, to)) {
      setToast('Влечење само кон следниот чекор. Отвори го лидот за враќање/губење.');
      return;
    }
    move.mutate(
      { to },
      { onError: (e) => setToast(e instanceof ApiRequestError ? e.message : 'Грешка.') },
    );
  };

  return (
    <div style={boardWrap}>
      {columns.map((col) => {
        const isDirCol = col.meta.owner === 'dir';
        return (
          <div
            key={col.key}
            onDragOver={(e) => {
              e.preventDefault();
              setOver(col.key);
            }}
            onDrop={() => drop(col.key)}
            style={column(over === col.key, isDirCol)}
          >
            <div style={colHeader}>
              <span style={stepNum(col.meta.color)}>
                {col.meta.step <= 11 ? col.meta.step : '✓'}
              </span>
              {col.meta.label}
              <span style={{ color: 'var(--gd-ink-muted)', fontWeight: 400 }}>
                · {col.cards.length}
              </span>
            </div>
            <div style={colBody}>
              {col.cards.map((l) => {
                const can = canActOnLead(l, me);
                const draggable = can && !!crmForwardTarget(l.status);
                return (
                  <LeadCard
                    key={l.id}
                    lead={l}
                    can={can}
                    dragging={drag?.id === l.id}
                    draggable={draggable}
                    onOpen={() => onOpen(l.id)}
                    onDragStart={() => draggable && setDrag({ id: l.id, from: l.status })}
                    onDragEnd={() => {
                      setDrag(null);
                      setOver(null);
                    }}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
      {toast && (
        <div style={toastStyle} onAnimationEnd={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  );
}

function LeadCard({
  lead,
  can,
  dragging,
  draggable,
  onOpen,
  onDragStart,
  onDragEnd,
}: {
  lead: LeadRow;
  can: boolean;
  dragging: boolean;
  draggable: boolean;
  onOpen: () => void;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const ver =
    lead.offers && CRM_STATUS_META[lead.status].step >= 3 && CRM_STATUS_META[lead.status].step <= 5
      ? lead.offers.length
        ? `Понуда v${lead.offers.length}`
        : ''
      : lead.contracts &&
          CRM_STATUS_META[lead.status].step >= 7 &&
          CRM_STATUS_META[lead.status].step <= 9
        ? lead.contracts.length
          ? `Договор v${lead.contracts.length}`
          : ''
        : '';
  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      style={card(can, dragging)}
    >
      <div style={{ fontWeight: 600, fontSize: 13 }}>{lead.name}</div>
      <div style={{ color: 'var(--gd-ink-muted)', fontSize: 12, marginTop: 2 }}>
        {lead.source} · {lead.pkgHint}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8 }}>
        {ver && <span style={verPill}>{ver}</span>}
        {lead.waitDir && (
          <span style={{ ...verPill, background: '#F5F3FF', color: '#6D28D9' }}>чека директор</span>
        )}
        {lead.isStale && (
          <span style={{ ...verPill, background: '#FEF2F2', color: '#B91C1C' }}>
            {lead.stale} дена без промена
          </span>
        )}
      </div>
    </div>
  );
}

function ApproveList({ leads, onOpen }: { leads: LeadRow[]; onOpen: (id: string) => void }) {
  const rows = leads.filter((l) => l.waitDir);
  if (rows.length === 0) return <Empty text="Нема лидови што чекаат одобрување." />;
  return (
    <div style={listWrap}>
      {rows.map((l) => {
        const isOffer = l.status === 'ponudaOdob';
        const arr = (isOffer ? l.offers : l.contracts) ?? [];
        const doc = `${isOffer ? 'Понуда v' : 'Договор v'}${arr.length}`;
        return (
          <button key={l.id} type="button" onClick={() => onOpen(l.id)} style={listRow}>
            <div>
              <div style={{ fontWeight: 600 }}>{l.name}</div>
              <div style={{ color: 'var(--gd-ink-muted)', fontSize: 12 }}>{doc}</div>
            </div>
            <span
              style={{ ...verPill, background: '#F5F3FF', color: '#6D28D9', marginLeft: 'auto' }}
            >
              {CRM_STATUS_META[l.status].label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function LostList({ leads, onOpen }: { leads: LeadRow[]; onOpen: (id: string) => void }) {
  const rows = leads.filter((l) => l.status === 'izguben');
  if (rows.length === 0) return <Empty text="Нема изгубени лидови." />;
  return (
    <div style={listWrap}>
      {rows.map((l) => (
        <button key={l.id} type="button" onClick={() => onOpen(l.id)} style={listRow}>
          <div>
            <div style={{ fontWeight: 600 }}>{l.name}</div>
            <div style={{ color: 'var(--gd-ink-muted)', fontSize: 12 }}>
              {l.lossReason ?? '—'}
              {l.lossNote ? ` · ${l.lossNote}` : ''}
            </div>
          </div>
          {l.lostFromStatus && (
            <span style={{ ...verPill, marginLeft: 'auto' }}>
              од {CRM_STATUS_META[l.lostFromStatus].label}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div style={{ padding: 40, color: 'var(--gd-ink-muted)', textAlign: 'center' }}>{text}</div>
  );
}

// ── стилови (визуелен систем v1) ──
const rail: React.CSSProperties = {
  width: 240,
  flexShrink: 0,
  borderRight: '1px solid var(--gd-border)',
  padding: 12,
  overflowY: 'auto',
};
const railTitle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: 'var(--gd-ink-muted)',
  padding: '4px 8px',
};
const railItem = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '7px 8px',
  borderRadius: 6,
  border: 'none',
  background: active ? 'var(--gd-brand-50, #EBF2FF)' : 'transparent',
  color: active ? '#0052D9' : 'var(--gd-ink)',
  fontWeight: active ? 600 : 500,
  fontSize: 13,
  cursor: 'pointer',
  textAlign: 'left',
});
const topBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 16px',
  borderBottom: '1px solid var(--gd-border)',
  gap: 8,
};
const tab = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: 'none',
  background: active ? '#0866FF' : 'transparent',
  color: active ? '#fff' : 'var(--gd-ink)',
  fontWeight: active ? 600 : 500,
  fontSize: 13,
  cursor: 'pointer',
});
const primaryBtn: React.CSSProperties = {
  marginLeft: 'auto',
  padding: '8px 14px',
  borderRadius: 6,
  border: 'none',
  background: '#0866FF',
  color: '#fff',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};
const boardWrap: React.CSSProperties = {
  display: 'flex',
  gap: 12,
  padding: 16,
  overflowX: 'auto',
  flex: 1,
  minHeight: 0,
};
const column = (over: boolean, dirCol: boolean): React.CSSProperties => ({
  width: 260,
  flexShrink: 0,
  background: dirCol ? '#F5F3FF' : '#F7F8FA',
  borderRadius: 8,
  border: `1px ${over ? 'dashed' : 'solid'} ${over ? '#0866FF' : 'var(--gd-border)'}`,
  padding: 8,
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
});
const colHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontWeight: 600,
  fontSize: 13,
  padding: '4px 4px 8px',
};
const stepNum = (color: string): React.CSSProperties => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: color,
  color: '#fff',
  fontSize: 11,
  fontWeight: 700,
});
const colBody: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  overflowY: 'auto',
  flex: 1,
  minHeight: 0,
};
const card = (can: boolean, dragging: boolean): React.CSSProperties => ({
  background: '#fff',
  border: `1px solid ${can ? '#C7DCFF' : 'var(--gd-border)'}`,
  borderRadius: 8,
  padding: 10,
  cursor: 'pointer',
  opacity: dragging ? 0.5 : 1,
  boxShadow: '0 1px 2px rgba(0,0,0,.04)',
});
const verPill: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 999,
  background: '#EBF2FF',
  color: '#0052D9',
};
const listWrap: React.CSSProperties = {
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  overflowY: 'auto',
  flex: 1,
  minHeight: 0,
};
const listRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 12,
  borderRadius: 8,
  border: '1px solid var(--gd-border)',
  background: '#fff',
  cursor: 'pointer',
  textAlign: 'left',
  width: '100%',
};
const toastStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 20,
  right: 20,
  background: '#12161C',
  color: '#fff',
  padding: '10px 16px',
  borderRadius: 8,
  fontSize: 13,
  zIndex: 60,
};
