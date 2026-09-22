import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { TaskStatus } from '@gd/core';
import { Button, Modal, tokens } from '@gd/ui';
import { useClients } from '../api/admin.js';
import { useConfirmMonth, useGenerateSlots, usePatchSlot, useSlots } from '../api/slots.js';
import { useDateChange } from '../api/tasks.js';
import { ApiRequestError } from '../lib/api.js';
import { MONTH_LABELS, WEEKDAY_LABELS, buildMonthGrid, monthKeyOf, ymd } from '../lib/calendar.js';
import type { SlotRow } from '../lib/types.js';
import { StatusBadge } from '../components/StatusBadge.js';

type TypeFilter = 'all' | 'video' | 'graphic';

const WEEKDAY_FULL = ['Понеделник', 'Вторник', 'Среда', 'Четврток', 'Петок', 'Сабота', 'Недела'];

const SLOT_STATUS_LABEL: Record<string, string> = {
  predlog: 'предлог',
  free: 'слободен',
  reserved: 'резервиран',
  used: 'искористен',
  missed: 'пропуштен',
};

/** Легенда (Handoff §2.4) — визуелен клуч на боите. */
const LEGEND: Array<{ label: string; color: string; dashed?: boolean; prefix?: string }> = [
  { label: 'Монтажа/Дизајн', color: tokens.statusColor.montaza },
  { label: 'Одобрување', color: tokens.statusColor.vnatresno },
  { label: 'Кај клиент', color: tokens.statusColor.kajKlient },
  { label: 'Објавено', color: tokens.statusColor.objaveno, prefix: '✓' },
  { label: 'Аналитика', color: tokens.statusColor.analitika, prefix: '◔' },
  { label: 'Празен слот', color: 'var(--gd-danger)', dashed: true },
];

export function Calendar() {
  const now = new Date();
  const todayKey = ymd(now);
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month0, setMonth0] = useState(now.getUTCMonth());
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [moving, setMoving] = useState<SlotRow | null>(null);
  const [drag, setDrag] = useState<{ taskId: string; title: string } | null>(null);
  const [dc, setDc] = useState<{ taskId: string; newDate: string; title: string } | null>(null);
  const [reason, setReason] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>(todayKey);
  const [winW, setWinW] = useState(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth,
  );

  useEffect(() => {
    const on = () => setWinW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const weekdays = winW >= 820 ? WEEKDAY_FULL : WEEKDAY_LABELS;
  const stackPanel = winW < 1100;

  const { data: clients } = useClients();
  const [clientId, setClientId] = useState<string | null>(null);
  const activeClient = clientId ?? clients?.[0]?.id ?? null;
  const monthKey = monthKeyOf(year, month0);

  const { data: slots, isLoading } = useSlots(activeClient, monthKey);
  const generate = useGenerateSlots(activeClient ?? '', monthKey);
  const confirm = useConfirmMonth(activeClient ?? '', monthKey);
  const patch = usePatchSlot(activeClient ?? '', monthKey);
  const dateChange = useDateChange(dc?.taskId ?? '');

  const grid = useMemo(() => buildMonthGrid(year, month0), [year, month0]);
  const visible = (slots ?? []).filter((s) => typeFilter === 'all' || s.contentType === typeFilter);
  const byDay = useMemo(() => {
    const map = new Map<string, SlotRow[]>();
    for (const s of visible) {
      const key = s.date.slice(0, 10);
      const arr = map.get(key) ?? [];
      arr.push(s);
      map.set(key, arr);
    }
    return map;
  }, [visible]);

  const proposal = visible.filter((s) => s.status === 'predlog');
  const isProposal = proposal.length > 0;
  const daySlots = byDay.get(selectedDay) ?? [];

  const shiftMonth = (delta: number) => {
    const d = new Date(Date.UTC(year, month0 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth0(d.getUTCMonth());
  };

  const runConfirm = () =>
    confirm.mutate(undefined, {
      onSuccess: () => setToast('Месецот е потврден. Слотовите се резервирани.'),
      onError: (e) => setToast(e instanceof ApiRequestError ? e.message : 'Грешка.'),
    });
  const runGenerate = () =>
    generate.mutate(undefined, {
      onSuccess: () => setToast('Предлог-распоредот е генериран.'),
      onError: (e) => setToast(e instanceof ApiRequestError ? e.message : 'Грешка.'),
    });

  return (
    <div style={{ padding: '24px 20px' }}>
      {/* Заглавие + контроли */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button onClick={() => shiftMonth(-1)} style={navBtn} aria-label="Претходен месец">
          <ChevronLeft size={16} />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, minWidth: 180 }}>
          {MONTH_LABELS[month0]} {year}
        </h1>
        <button onClick={() => shiftMonth(1)} style={navBtn} aria-label="Следен месец">
          <ChevronRight size={16} />
        </button>
        <select
          value={activeClient ?? ''}
          onChange={(e) => setClientId(e.target.value)}
          className="gd-field"
          style={{ width: 180, height: 28 }}
        >
          {(clients ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['all', 'video', 'graphic'] as TypeFilter[]).map((t) => (
            <button key={t} onClick={() => setTypeFilter(t)} style={toggleBtn(typeFilter === t)}>
              {t === 'all' ? 'Сè' : t === 'video' ? 'Видео' : 'Графика'}
            </button>
          ))}
        </div>
      </div>

      {/* Легенда */}
      <div style={legendRow}>
        {LEGEND.map((l) => (
          <span key={l.label} style={legendItem}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: l.dashed ? 'transparent' : l.color,
                border: l.dashed ? `1px dashed ${l.color}` : 'none',
              }}
            />
            {l.prefix ? `${l.prefix} ` : ''}
            {l.label}
          </span>
        ))}
      </div>

      {/* Предлог банер */}
      {isProposal && (
        <div style={proposalBanner}>
          <span>
            Предлог за {MONTH_LABELS[month0]}:{' '}
            {proposal.filter((s) => s.contentType === 'video').length} видео ·{' '}
            {proposal.filter((s) => s.contentType === 'graphic').length} графика
          </span>
          <Button size="form" onClick={runConfirm} disabled={confirm.isPending}>
            {confirm.isPending ? 'Потврдување…' : 'Потврди месец'}
          </Button>
        </div>
      )}

      {/* Празна состојба */}
      {!isLoading && (slots?.length ?? 0) === 0 && (
        <div style={emptyState}>
          <p style={{ color: 'var(--gd-ink-muted)', margin: '0 0 12px' }}>
            {MONTH_LABELS[month0]} уште не е испланиран.
          </p>
          <Button size="form" onClick={runGenerate} disabled={generate.isPending}>
            {generate.isPending ? 'Генерирање…' : 'Генерирај распоред'}
          </Button>
        </div>
      )}

      {/* Мрежа + ден-панел */}
      <div style={{ display: 'flex', gap: 16, flexDirection: stackPanel ? 'column' : 'row' }}>
        <div style={{ ...gridWrap, flex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {weekdays.map((w) => (
              <div key={w} style={weekdayHead}>
                {w}
              </div>
            ))}
          </div>
          {grid.map((week, wi) => (
            <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {week.map((cell) => {
                const isToday = cell.key === todayKey;
                const isPast = cell.key < todayKey;
                const isSel = cell.key === selectedDay;
                return (
                  <button
                    key={cell.key}
                    onClick={() => setSelectedDay(cell.key)}
                    onDragOver={(e) => {
                      if (drag) e.preventDefault();
                    }}
                    onDrop={() => {
                      if (!drag) return;
                      if (isPast) {
                        setToast('Не може да се помести во минато.');
                        setDrag(null);
                        return;
                      }
                      setDc({ taskId: drag.taskId, newDate: cell.key, title: drag.title });
                      setReason('');
                      setDrag(null);
                    }}
                    style={dayCell(cell.inMonth, isSel)}
                  >
                    <div style={dayNum(isToday, isPast)}>{cell.date.getUTCDate()}</div>
                    {(byDay.get(cell.key) ?? []).map((s) => {
                      const draggable = s.status === 'reserved' && !!s.task;
                      return (
                        <span
                          key={s.id}
                          draggable={draggable}
                          onDragStart={() =>
                            s.task && setDrag({ taskId: s.task.id, title: s.task.title })
                          }
                          onClick={(e) => {
                            if (s.status === 'predlog') {
                              e.stopPropagation();
                              setMoving(s);
                            }
                          }}
                          style={slotBar(s)}
                          title={
                            s.status === 'predlog'
                              ? 'Кликни за поместување'
                              : draggable
                                ? 'Влечи за промена на датум'
                                : SLOT_STATUS_LABEL[s.status]
                          }
                        >
                          {s.contentType === 'video' ? '▶' : '▧'}{' '}
                          {s.task ? s.task.title : s.contentType === 'video' ? 'Видео' : 'Графика'}
                          {s.orderInDay === 2 ? ' ②' : ''}
                        </span>
                      );
                    })}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Ден-панел 300px */}
        <aside style={{ ...dayPanel, width: stackPanel ? '100%' : 300 }}>
          <div style={dayPanelHead}>
            {selectedDay.slice(8, 10)}.{selectedDay.slice(5, 7)}.{selectedDay.slice(0, 4)}
          </div>
          {daySlots.length === 0 ? (
            <p style={{ color: 'var(--gd-ink-muted)', fontSize: 13, padding: '8px 0' }}>
              Нема објави за овој ден.
            </p>
          ) : (
            daySlots.map((s) => (
              <div key={s.id} style={dayPanelRow}>
                <span
                  style={{
                    fontWeight: 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.task ? s.task.title : s.contentType === 'video' ? '▶ Видео' : '▧ Графика'}
                </span>
                {s.task ? (
                  <StatusBadge status={s.task.status as TaskStatus} />
                ) : (
                  <span style={{ color: 'var(--gd-ink-muted)', fontSize: 12 }}>
                    {SLOT_STATUS_LABEL[s.status] ?? s.status}
                  </span>
                )}
              </div>
            ))
          )}
        </aside>
      </div>

      <Modal
        open={!!moving}
        onClose={() => setMoving(null)}
        title="Помести предлог-слот"
        width={360}
      >
        {moving && (
          <MoveForm
            slot={moving}
            onClose={() => setMoving(null)}
            patch={patch}
            setToast={setToast}
          />
        )}
      </Modal>

      <Modal open={!!dc} onClose={() => setDc(null)} title="Промени датум" width={360}>
        {dc && (
          <div>
            <p style={{ fontSize: 13, margin: '0 0 12px' }}>
              „{dc.title}" → {dc.newDate.slice(8, 10)}.{dc.newDate.slice(5, 7)}.
              {dc.newDate.slice(0, 4)}
            </p>
            <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gd-ink-muted)' }}>
              Причина
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="gd-field"
                style={{ display: 'block', width: '100%', marginTop: 4 }}
              />
            </label>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <Button variant="secondary" size="form" onClick={() => setDc(null)}>
                Откажи
              </Button>
              <Button
                size="form"
                disabled={dateChange.isPending || !reason.trim()}
                onClick={() =>
                  dateChange.mutate(
                    { newDate: dc.newDate, reason },
                    {
                      onSuccess: () => {
                        setDc(null);
                        setToast('Датумот е променет.');
                      },
                      onError: (e) =>
                        setToast(e instanceof ApiRequestError ? e.message : 'Грешка.'),
                    },
                  )
                }
              >
                Промени
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {toast && (
        <div style={toastStyle} onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  );
}

function MoveForm({
  slot,
  onClose,
  patch,
  setToast,
}: {
  slot: SlotRow;
  onClose: () => void;
  patch: ReturnType<typeof usePatchSlot>;
  setToast: (v: string) => void;
}) {
  const [date, setDate] = useState(slot.date.slice(0, 10));
  return (
    <div>
      <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gd-ink-muted)' }}>
        Нов датум
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="gd-field"
          style={{ display: 'block', width: '100%', marginTop: 4 }}
        />
      </label>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button variant="secondary" size="form" onClick={onClose}>
          Откажи
        </Button>
        <Button
          size="form"
          disabled={patch.isPending}
          onClick={() =>
            patch.mutate(
              { id: slot.id, date, orderInDay: slot.orderInDay },
              {
                onSuccess: () => {
                  onClose();
                  setToast('Слотот е поместен.');
                },
                onError: (e) => setToast(e instanceof ApiRequestError ? e.message : 'Грешка.'),
              },
            )
          }
        >
          Помести
        </Button>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--gd-border)',
  borderRadius: 6,
  background: 'var(--gd-surface)',
  cursor: 'pointer',
};
const toggleBtn = (active: boolean): React.CSSProperties => ({
  height: 28,
  padding: '0 12px',
  border: '1px solid var(--gd-border)',
  borderRadius: 6,
  background: active ? 'var(--gd-primary-tint)' : 'var(--gd-surface)',
  color: active ? 'var(--gd-primary-hover)' : 'var(--gd-ink)',
  cursor: 'pointer',
  fontSize: 13,
});
const legendRow: React.CSSProperties = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 16,
  marginBottom: 16,
  fontSize: 12,
  color: 'var(--gd-ink-secondary)',
};
const legendItem: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 };
const proposalBanner: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 16,
  border: '1px solid var(--gd-primary-border)',
  background: 'var(--gd-primary-wash)',
  borderRadius: 'var(--gd-radius-card)',
  marginBottom: 16,
};
const emptyState: React.CSSProperties = {
  padding: 32,
  textAlign: 'center',
  border: '1px dashed var(--gd-border)',
  borderRadius: 'var(--gd-radius-card)',
  marginBottom: 16,
  background: 'var(--gd-surface)',
};
const gridWrap: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 'var(--gd-radius-card)',
  overflow: 'hidden',
  background: 'var(--gd-surface)',
};
const weekdayHead: React.CSSProperties = {
  padding: '8px 10px',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--gd-ink-muted)',
  background: 'var(--gd-surface-alt)',
  borderBottom: '1px solid var(--gd-border)',
};
const dayCell = (inMonth: boolean, selected: boolean): React.CSSProperties => ({
  minHeight: 96,
  padding: 6,
  textAlign: 'left',
  border: 'none',
  borderRight: '1px solid var(--gd-border)',
  borderBottom: '1px solid var(--gd-border)',
  background: selected
    ? 'var(--gd-primary-tint)'
    : inMonth
      ? 'var(--gd-surface)'
      : 'var(--gd-surface-pad)',
  opacity: inMonth ? 1 : 0.5,
  cursor: 'pointer',
});
const dayNum = (isToday: boolean, isPast: boolean): React.CSSProperties => ({
  fontSize: 12,
  marginBottom: 4,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minWidth: 20,
  height: 20,
  borderRadius: '50%',
  fontWeight: isToday ? 700 : 400,
  color: isToday ? '#fff' : isPast ? 'var(--gd-ink-muted)' : 'var(--gd-ink)',
  background: isToday ? 'var(--gd-success)' : 'transparent',
  fontVariantNumeric: 'tabular-nums',
});
const slotBar = (s: SlotRow): React.CSSProperties => {
  const base: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    fontSize: 12,
    padding: '3px 6px',
    marginBottom: 3,
    borderRadius: 4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  };
  if (s.status === 'predlog') {
    return {
      ...base,
      cursor: 'pointer',
      border: '1px dashed var(--gd-danger)',
      color: 'var(--gd-danger-text)',
      background: 'transparent',
    };
  }
  if (s.task) {
    const key = s.task.status as keyof typeof tokens.statusColor;
    const c = tokens.statusColor[key] ?? tokens.color.inkMuted;
    const text = tokens.statusText[key] ?? tokens.color.ink;
    return {
      ...base,
      cursor: s.status === 'reserved' ? 'grab' : 'default',
      border: `1px solid ${c}`,
      color: text,
      background: tokens.hexAlpha(c, 0.1),
    };
  }
  return {
    ...base,
    cursor: 'default',
    border: '1px solid var(--gd-border)',
    color: 'var(--gd-ink)',
    background: 'var(--gd-surface-alt)',
  };
};
const dayPanel: React.CSSProperties = {
  flex: '0 0 auto',
  border: '1px solid var(--gd-border)',
  borderRadius: 'var(--gd-radius-card)',
  background: 'var(--gd-surface)',
  padding: 12,
  alignSelf: 'flex-start',
};
const dayPanelHead: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  marginBottom: 8,
  fontVariantNumeric: 'tabular-nums',
};
const dayPanelRow: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  padding: '8px 0',
  borderBottom: '1px solid var(--gd-border)',
  fontSize: 13,
};
const toastStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 20,
  right: 20,
  background: '#12161C',
  color: '#fff',
  padding: '10px 16px',
  borderRadius: 8,
  fontSize: 14,
  cursor: 'pointer',
  boxShadow: 'var(--gd-shadow-toast)',
};
