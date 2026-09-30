import type React from 'react';
import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { t } from '@gd/ui';
import { useShootCalendar, type ShootCalendarItem } from '../api/shoots.js';
import { MONTH_LABELS } from '../lib/calendar.js';

const WD = [
  t('shootCalendar.wd0'),
  t('shootCalendar.wd1'),
  t('shootCalendar.wd2'),
  t('shootCalendar.wd3'),
  t('shootCalendar.wd4'),
  t('shootCalendar.wd5'),
  t('shootCalendar.wd6'),
];
const monthKeyOf = (y: number, m0: number) => `${y}-${String(m0 + 1).padStart(2, '0')}`;
const timeLabel = (iso: string) => {
  const d = new Date(iso);
  const hh = d.getUTCHours();
  const mm = d.getUTCMinutes();
  return hh || mm ? `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}` : '';
};
const dayHeader = (iso: string) => {
  const d = new Date(iso);
  return `${WD[d.getUTCDay()]} ${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
};

/**
 * Календар на снимање (Режисер · Директор · Камерман): договорените термини по датум
 * (клиент, локација, час). Читa од `ShootSession` (од СЦЕНАРИА натаму).
 */
export function ShootCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getUTCFullYear());
  const [month0, setMonth0] = useState(now.getUTCMonth());
  const { data, isLoading } = useShootCalendar(monthKeyOf(year, month0));

  const byDay = useMemo(() => {
    const map = new Map<string, ShootCalendarItem[]>();
    for (const s of data?.shoots ?? []) {
      const key = s.date.slice(0, 10);
      (map.get(key) ?? map.set(key, []).get(key)!).push(s);
    }
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [data]);

  const shift = (delta: number) => {
    const d = new Date(Date.UTC(year, month0 + delta, 1));
    setYear(d.getUTCFullYear());
    setMonth0(d.getUTCMonth());
  };

  return (
    <div style={{ padding: '24px 20px 48px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <button onClick={() => shift(-1)} style={navBtn} aria-label={t('calendar.prevMonth')}>
          <ChevronLeft size={16} />
        </button>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0, minWidth: 180 }}>
          {t('shootCalendar.title', { month: MONTH_LABELS[month0] ?? '', year })}
        </h1>
        <button onClick={() => shift(1)} style={navBtn} aria-label={t('calendar.nextMonth')}>
          <ChevronRight size={16} />
        </button>
      </div>

      {isLoading && <p style={{ color: 'var(--gd-ink-muted)' }}>{t('shootCalendar.loading')}</p>}
      {!isLoading && byDay.length === 0 && <div style={empty}>{t('shootCalendar.empty')}</div>}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {byDay.map(([day, shoots]) => (
          <div key={day} style={card}>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
              {dayHeader(shoots[0]!.date)}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shoots.map((s) => (
                <div key={s.id} style={row}>
                  <span
                    style={{ width: 8, height: 8, borderRadius: '50%', background: s.clientColor }}
                  />
                  <strong style={{ fontSize: 13, minWidth: 140 }}>{s.clientName}</strong>
                  <span style={{ fontVariantNumeric: 'tabular-nums', minWidth: 44 }}>
                    {timeLabel(s.date) || '—'}
                  </span>
                  <span style={loc}>
                    <MapPin size={12} /> {s.location || '—'}
                  </span>
                  {s.kind === 'additional' && (
                    <span style={badge}>{t('shootCalendar.additional')}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const navBtn: React.CSSProperties = {
  width: 28,
  height: 28,
  borderRadius: 6,
  border: '1px solid var(--gd-border)',
  background: 'var(--gd-surface)',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
};
const card: React.CSSProperties = {
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  padding: 14,
};
const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  fontSize: 13,
  flexWrap: 'wrap',
};
const loc: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  color: 'var(--gd-ink-secondary)',
};
const badge: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--gd-ink-muted)',
  background: 'var(--gd-surface-alt)',
  border: '1px solid var(--gd-border)',
  borderRadius: 9999,
  padding: '1px 8px',
};
const empty: React.CSSProperties = {
  background: 'var(--gd-surface)',
  border: '1px dashed var(--gd-border)',
  borderRadius: 8,
  padding: 24,
  color: 'var(--gd-ink-muted)',
  textAlign: 'center',
};
