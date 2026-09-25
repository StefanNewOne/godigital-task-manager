import type React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@gd/ui';
import { Check } from 'lucide-react';
import {
  useConfirmMonthlyPlan,
  useGenerateMonth,
  useMonthlyPlan,
  usePutMonthlyPlan,
} from '../api/monthlyPlan.js';
import { ApiRequestError } from '../lib/api.js';

const MK_MONTHS = [
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
const fmtMonth = (mk: string) => {
  const [y, m] = mk.split('-');
  return `${MK_MONTHS[Number(m) - 1] ?? m} ${y}`;
};

/** Месечен план (Директор): одобри кои клиенти се работат за месецот, потоа генерирај. */
export function MonthlyPlanModal({ month, onClose }: { month: string; onClose: () => void }) {
  const { data } = useMonthlyPlan(month);
  const put = usePutMonthlyPlan(month);
  const confirm = useConfirmMonthlyPlan(month);
  const generate = useGenerateMonth(month);

  const [active, setActive] = useState<Record<string, boolean>>({});
  const [toast, setToast] = useState<string | null>(null);
  const pushToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast((t) => (t === m ? null : t)), 4200);
  };
  const onErr = (e: unknown) =>
    pushToast(e instanceof ApiRequestError ? e.message : 'Настана грешка.');

  useEffect(() => {
    if (data) setActive(Object.fromEntries(data.clients.map((c) => [c.clientId, c.active])));
  }, [data]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const clients = data?.clients ?? [];
  const activeCount = clients.filter((c) => active[c.clientId]).length;
  const busy = put.isPending || confirm.isPending || generate.isPending;

  const payload = () =>
    clients.map((c) => ({ clientId: c.clientId, active: !!active[c.clientId] }));

  return (
    <div style={backdrop} onClick={onClose}>
      <div style={box} className="gd-fade-up" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <span style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600 }}>
            Месечен план · {fmtMonth(month)}
          </span>
          {data?.confirmed && (
            <span style={confirmedPill}>
              <Check size={12} /> Потврден
            </span>
          )}
        </div>
        <div style={{ fontSize: 13, color: 'var(--gd-ink-muted)', marginBottom: 16 }}>
          Одбери кои клиенти се работат за {fmtMonth(month)}. Неодобрен клиент не може да добие капа
          ниту интервентен таск за тој месец. Рок: 15-ти во тековниот месец.
        </div>

        <div style={list}>
          {clients.map((c) => (
            <label key={c.clientId} style={row}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={!!active[c.clientId]}
                aria-label={c.name}
                onClick={() => setActive((s) => ({ ...s, [c.clientId]: !s[c.clientId] }))}
                style={toggle(!!active[c.clientId])}
              >
                <span style={knob(!!active[c.clientId])} />
              </button>
            </label>
          ))}
        </div>

        <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)', margin: '10px 0' }}>
          {activeCount} активни клиенти
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="secondary" size="form" onClick={onClose}>
            Затвори
          </Button>
          <Button
            variant="secondary"
            size="form"
            disabled={busy}
            onClick={() =>
              put.mutate(payload(), {
                onSuccess: () => pushToast('Планот е зачуван.'),
                onError: onErr,
              })
            }
          >
            Зачувај
          </Button>
          <Button
            variant="primary"
            size="form"
            disabled={busy || activeCount < 1}
            onClick={() =>
              put.mutate(payload(), {
                onSuccess: () =>
                  confirm.mutate(undefined, {
                    onSuccess: () => pushToast('Месецот е потврден.'),
                    onError: onErr,
                  }),
                onError: onErr,
              })
            }
          >
            Потврди месец
          </Button>
          {data?.confirmed && (
            <Button
              variant="primary"
              size="form"
              disabled={busy}
              onClick={() =>
                generate.mutate(undefined, {
                  onSuccess: (r) => pushToast(`Генериран распоред за ${r.clients} клиенти.`),
                  onError: onErr,
                })
              }
            >
              Генерирај распоред
            </Button>
          )}
        </div>

        {toast && (
          <div style={toastStyle} onClick={() => setToast(null)}>
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

const backdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 70,
  background: 'rgba(18,22,28,.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const box: React.CSSProperties = {
  width: 460,
  maxWidth: '92vw',
  maxHeight: '86vh',
  overflow: 'auto',
  background: 'var(--gd-surface)',
  borderRadius: 8,
  boxShadow: 'var(--gd-shadow-popover)',
  padding: 24,
};
const list: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  overflow: 'hidden',
};
const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  padding: '10px 12px',
  borderBottom: '1px solid var(--gd-border)',
  fontSize: 14,
};
const toggle = (on: boolean): React.CSSProperties => ({
  width: 40,
  height: 22,
  borderRadius: 9999,
  border: 'none',
  background: on ? 'var(--gd-primary)' : 'var(--gd-border)',
  cursor: 'pointer',
  padding: 0,
  position: 'relative',
  flex: '0 0 auto',
  transition: 'background .15s',
});
const knob = (on: boolean): React.CSSProperties => ({
  position: 'absolute',
  top: 2,
  left: on ? 20 : 2,
  width: 18,
  height: 18,
  borderRadius: '50%',
  background: '#fff',
  transition: 'left .15s',
});
const confirmedPill: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  fontSize: 11,
  fontWeight: 600,
  color: 'var(--gd-success-text)',
  background: 'rgba(22,163,74,.1)',
  border: '1px solid var(--gd-success)',
  borderRadius: 9999,
  padding: '1px 8px',
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
  zIndex: 80,
};
