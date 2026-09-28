import type React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@gd/ui';
import { X } from 'lucide-react';
import { useApproveMonth, useMonthProposal, type ComboProposal } from '../api/monthlyCalendar.js';
import { ApiRequestError } from '../lib/api.js';

const comboKey = (c: { videos: number; graphics: number }) => `${c.videos}x${c.graphics}`;
const dayLabel = (iso: string) => iso.slice(8, 10) + '.' + iso.slice(5, 7);

type Edits = Record<string, { videoDates: string[]; graphicDates: string[] }>;

/** Месечно одобрување на календар (АМ/Директор): групирано по комбинација, уредливо. */
export function MonthApproval({ month }: { month: string }) {
  const { data, isLoading } = useMonthProposal(month, true);
  const approve = useApproveMonth();
  const [edits, setEdits] = useState<Edits>({});
  const [toast, setToast] = useState<string | null>(null);

  // Иницијализирај ги edits од предлогот кога ќе стигне (по месец).
  useEffect(() => {
    if (!data) return;
    const init: Edits = {};
    for (const c of data.combinations) {
      init[comboKey(c)] = { videoDates: [...c.videoDates], graphicDates: [...c.graphicDates] };
    }
    setEdits(init);
  }, [data]);

  if (isLoading) return <div style={panel}>Вчитување…</div>;
  if (!data) return null;
  if (!data.hasStandard) {
    return (
      <div style={panel}>
        <p style={muted}>
          Прво постави <strong>Стандарден календар</strong> (Календарски поставки) — тогаш системот
          ќе предложи датуми по комбинација.
        </p>
      </div>
    );
  }
  if (data.combinations.length === 0) {
    return (
      <div style={panel}>
        <p style={muted}>Нема стандардни клиенти за овој месец.</p>
      </div>
    );
  }

  const setDates = (key: string, kind: 'videoDates' | 'graphicDates', dates: string[]) =>
    setEdits((e) => ({ ...e, [key]: { ...e[key]!, [kind]: dates } }));

  const runApprove = () =>
    approve.mutate(
      { month, edits },
      {
        onSuccess: (r) =>
          setToast(
            `Одобрено: ${r.approvedClients} клиенти${r.skipped ? `, ${r.skipped} веќе` : ''}.`,
          ),
        onError: (e) => setToast(e instanceof ApiRequestError ? e.message : 'Грешка.'),
      },
    );

  return (
    <div style={panel}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, margin: 0 }}>Одобри месец · {month}</h3>
        <Button
          variant="primary"
          size="toolbar"
          style={{ marginLeft: 'auto' }}
          disabled={approve.isPending}
          onClick={runApprove}
        >
          {approve.isPending ? 'Одобрување…' : 'Одобри месец'}
        </Button>
      </div>
      <p style={muted}>
        Предлог по комбинација (број видеа · графики). Уреди ги датумите; се применува на сите
        стандардни клиенти со таа комбинација.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {data.combinations.map((c) => (
          <ComboBlock
            key={comboKey(c)}
            combo={c}
            edit={edits[comboKey(c)] ?? { videoDates: c.videoDates, graphicDates: c.graphicDates }}
            onChange={(kind, dates) => setDates(comboKey(c), kind, dates)}
          />
        ))}
      </div>
      {toast && <span style={{ ...muted, marginTop: 8, display: 'block' }}>{toast}</span>}
    </div>
  );
}

function ComboBlock({
  combo,
  edit,
  onChange,
}: {
  combo: ComboProposal;
  edit: { videoDates: string[]; graphicDates: string[] };
  onChange: (kind: 'videoDates' | 'graphicDates', dates: string[]) => void;
}) {
  return (
    <div style={block}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <strong style={{ fontSize: 13 }}>
          {combo.videos} видеа · {combo.graphics} графики
        </strong>
        <span style={muted}>
          {combo.clients.length} клиенти: {combo.clients.map((c) => c.name).join(', ')}
        </span>
        {combo.approved && <span style={okBadge}>одобрено ✓</span>}
      </div>
      <DateRow
        label="Видео"
        dates={edit.videoDates}
        onChange={(d) => onChange('videoDates', d)}
        disabled={combo.approved}
      />
      <DateRow
        label="Графика"
        dates={edit.graphicDates}
        onChange={(d) => onChange('graphicDates', d)}
        disabled={combo.approved}
      />
    </div>
  );
}

function DateRow({
  label,
  dates,
  onChange,
  disabled,
}: {
  label: string;
  dates: string[];
  onChange: (dates: string[]) => void;
  disabled: boolean;
}) {
  const [add, setAdd] = useState('');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
      <span style={{ fontSize: 12, fontWeight: 600, minWidth: 56 }}>{label}</span>
      {dates.length === 0 && <span style={muted}>—</span>}
      {dates.map((d, i) => (
        <span key={`${d}-${i}`} style={chip}>
          {dayLabel(d)}
          {!disabled && (
            <X
              size={11}
              style={{ cursor: 'pointer' }}
              onClick={() => onChange(dates.filter((_, j) => j !== i))}
            />
          )}
        </span>
      ))}
      {!disabled && (
        <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>
          <input
            type="date"
            value={add}
            onChange={(e) => setAdd(e.target.value)}
            style={dateInput}
          />
          <button
            type="button"
            style={addBtn}
            onClick={() => {
              if (add) {
                onChange([...dates, add].sort());
                setAdd('');
              }
            }}
          >
            +
          </button>
        </span>
      )}
    </div>
  );
}

const panel: React.CSSProperties = {
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  padding: 16,
  marginBottom: 12,
};
const block: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  padding: '10px 12px',
};
const muted: React.CSSProperties = { fontSize: 12, color: 'var(--gd-ink-muted)' };
const chip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 12,
  fontVariantNumeric: 'tabular-nums',
  padding: '2px 6px',
  borderRadius: 6,
  background: 'var(--gd-surface-alt)',
  border: '1px solid var(--gd-border)',
};
const okBadge: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--gd-success-text)',
  background: 'rgba(22,163,74,.1)',
  borderRadius: 4,
  padding: '2px 6px',
};
const dateInput: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 6,
  padding: '2px 4px',
  fontSize: 12,
};
const addBtn: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 6,
  padding: '2px 8px',
  cursor: 'pointer',
  background: 'transparent',
  fontSize: 14,
};
