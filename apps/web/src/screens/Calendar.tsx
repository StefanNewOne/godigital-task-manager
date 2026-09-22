import type React from 'react';
import { useMemo, useState } from 'react';
import { useClients } from '../api/admin.js';
import { useConfirmMonth, useGenerateSlots, usePatchSlot, useSlots } from '../api/slots.js';
import { ApiRequestError } from '../lib/api.js';
import { MONTH_LABELS, WEEKDAY_LABELS, buildMonthGrid, monthKeyOf } from '../lib/calendar.js';
import type { SlotRow } from '../lib/types.js';

type TypeFilter = 'all' | 'video' | 'graphic';

export function Calendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month0, setMonth0] = useState(now.getUTCMonth());
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [moving, setMoving] = useState<SlotRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const { data: clients } = useClients();
  const [clientId, setClientId] = useState<string | null>(null);
  const activeClient = clientId ?? clients?.[0]?.id ?? null;
  const monthKey = monthKeyOf(year, month0);

  const { data: slots, isLoading } = useSlots(activeClient, monthKey);
  const generate = useGenerateSlots(activeClient ?? '', monthKey);
  const confirm = useConfirmMonth(activeClient ?? '', monthKey);
  const patch = usePatchSlot(activeClient ?? '', monthKey);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => shiftMonth(-1)} style={navBtn}>
          ‹
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, minWidth: 180 }}>
          {MONTH_LABELS[month0]} {year}
        </h1>
        <button onClick={() => shiftMonth(1)} style={navBtn}>
          ›
        </button>
        <select
          value={activeClient ?? ''}
          onChange={(e) => setClientId(e.target.value)}
          style={selectStyle}
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

      {/* Предлог банер (H1) */}
      {isProposal && (
        <div style={proposalBanner}>
          <span>
            Предлог за {MONTH_LABELS[month0]}:{' '}
            {proposal.filter((s) => s.contentType === 'video').length} видео ·{' '}
            {proposal.filter((s) => s.contentType === 'graphic').length} графика
          </span>
          <button onClick={runConfirm} disabled={confirm.isPending} style={primaryBtn}>
            {confirm.isPending ? 'Потврдување…' : 'Потврди месец'}
          </button>
        </div>
      )}

      {/* Празна состојба */}
      {!isLoading && (slots?.length ?? 0) === 0 && (
        <div style={emptyState}>
          <p style={{ color: 'var(--gd-ink-muted)', margin: '0 0 12px' }}>
            {MONTH_LABELS[month0]} уште не е испланиран.
          </p>
          <button onClick={runGenerate} disabled={generate.isPending} style={primaryBtn}>
            {generate.isPending ? 'Генерирање…' : 'Генерирај распоред'}
          </button>
        </div>
      )}

      {/* Мрежа */}
      <div style={gridWrap}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
          {WEEKDAY_LABELS.map((w) => (
            <div key={w} style={weekdayHead}>
              {w}
            </div>
          ))}
        </div>
        {grid.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
            {week.map((cell) => (
              <div key={cell.key} style={dayCell(cell.inMonth)}>
                <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)', marginBottom: 4 }}>
                  {cell.date.getUTCDate()}
                </div>
                {(byDay.get(cell.key) ?? []).map((s) => (
                  <button
                    key={s.id}
                    onClick={() => s.status === 'predlog' && setMoving(s)}
                    style={slotBar(s)}
                    title={s.status === 'predlog' ? 'Кликни за поместување' : s.status}
                  >
                    {s.contentType === 'video' ? '▶' : '▧'}{' '}
                    {s.contentType === 'video' ? 'Видео' : 'Графика'}
                    {s.orderInDay === 2 ? ' ②' : ''}
                  </button>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>

      {moving && (
        <MoveModal
          slot={moving}
          onClose={() => setMoving(null)}
          onMove={(date) => {
            patch.mutate(
              { id: moving.id, date, orderInDay: moving.orderInDay },
              {
                onSuccess: () => {
                  setMoving(null);
                  setToast('Слотот е поместен.');
                },
                onError: (e) => setToast(e instanceof ApiRequestError ? e.message : 'Грешка.'),
              },
            );
          }}
        />
      )}

      {toast && (
        <div style={toastStyle} onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  );
}

function MoveModal({
  slot,
  onClose,
  onMove,
}: {
  slot: SlotRow;
  onClose: () => void;
  onMove: (date: string) => void;
}) {
  const [date, setDate] = useState(slot.date.slice(0, 10));
  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ fontSize: 18, fontWeight: 600, margin: '0 0 12px' }}>Помести предлог-слот</h2>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gd-ink-muted)' }}>
          Нов датум
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{
              display: 'block',
              width: '100%',
              height: 36,
              marginTop: 4,
              boxSizing: 'border-box',
            }}
          />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button onClick={onClose} style={secondaryBtn}>
            Откажи
          </button>
          <button onClick={() => onMove(date)} style={primaryBtn}>
            Помести
          </button>
        </div>
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  border: '1px solid var(--gd-border)',
  borderRadius: 6,
  background: 'var(--gd-surface)',
  cursor: 'pointer',
};
const selectStyle: React.CSSProperties = {
  height: 28,
  border: '1px solid var(--gd-border)',
  borderRadius: 6,
  padding: '0 8px',
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
const dayCell = (inMonth: boolean): React.CSSProperties => ({
  minHeight: 96,
  padding: 6,
  borderRight: '1px solid var(--gd-border)',
  borderBottom: '1px solid var(--gd-border)',
  background: inMonth ? 'var(--gd-surface)' : 'var(--gd-surface-pad)',
  opacity: inMonth ? 1 : 0.5,
});
const slotBar = (s: SlotRow): React.CSSProperties => ({
  display: 'block',
  width: '100%',
  textAlign: 'left',
  fontSize: 12,
  padding: '3px 6px',
  marginBottom: 3,
  borderRadius: 4,
  cursor: s.status === 'predlog' ? 'pointer' : 'default',
  border: s.status === 'predlog' ? '1px dashed var(--gd-danger)' : '1px solid var(--gd-border)',
  color: s.status === 'predlog' ? 'var(--gd-danger-text)' : 'var(--gd-ink)',
  background: s.status === 'predlog' ? 'transparent' : 'var(--gd-surface-alt)',
});
const primaryBtn: React.CSSProperties = {
  height: 36,
  padding: '0 16px',
  background: 'var(--gd-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--gd-radius-button)',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  height: 36,
  padding: '0 16px',
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-border)',
  borderRadius: 'var(--gd-radius-button)',
  fontSize: 14,
  cursor: 'pointer',
};
const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const modal: React.CSSProperties = {
  width: 360,
  background: 'var(--gd-surface)',
  borderRadius: 'var(--gd-radius-card)',
  padding: 24,
  boxShadow: 'var(--gd-shadow-popover)',
};
const toastStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 20,
  right: 20,
  background: 'var(--gd-ink)',
  color: '#fff',
  padding: '10px 16px',
  borderRadius: 8,
  fontSize: 14,
  cursor: 'pointer',
  boxShadow: 'var(--gd-shadow-toast)',
};
