import type React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@gd/ui';
import { useClients } from '../../api/admin.js';
import { useMe } from '../../api/auth.js';
import {
  useSaveStandardCalendar,
  useStandardCalendar,
  type CalendarConfigRow,
} from '../../api/calendar.js';
import { ApiRequestError } from '../../lib/api.js';
import { tableStyles as s } from '../../components/table.js';

const WEEKDAYS: Array<{ n: number; l: string }> = [
  { n: 1, l: 'Пон' },
  { n: 2, l: 'Вто' },
  { n: 3, l: 'Сре' },
  { n: 4, l: 'Чет' },
  { n: 5, l: 'Пет' },
  { n: 6, l: 'Саб' },
  { n: 7, l: 'Нед' },
];

/**
 * Админ → Календари (Handoff §Админ). Стандарден календар (АМ/Директор го уредува без одобрување,
 * редизајн Парче 2) + read-only преглед на режимот по клиент.
 */
export function AdminCalendars() {
  const { data: clients, isLoading } = useClients();

  return (
    <div>
      <StandardCalendarEditor />
      <div
        style={{
          background: 'var(--gd-primary-tint)',
          border: '1px solid var(--gd-primary-border)',
          borderRadius: 8,
          padding: 16,
          fontSize: 13,
          color: 'var(--gd-ink-secondary)',
          marginBottom: 20,
        }}
      >
        Слотовите се генерираат <strong>автоматски на 20-ти во месецот, 06:00</strong>{' '}
        (Europe/Skopje). Предлог-распоредот го потврдува Акаунт менаџерот во екранот{' '}
        <strong>Календар</strong>. Празниците се води посебно и се одземаат од достапните денови.
      </div>

      {isLoading && <p style={{ color: 'var(--gd-ink-muted)' }}>Вчитување…</p>}
      {clients && (
        <div style={s.wrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Клиент</th>
                <th style={s.th}>Тип календар</th>
                <th style={{ ...s.th, textAlign: 'center' }}>Видео/мес</th>
                <th style={{ ...s.th, textAlign: 'center' }}>Графика/мес</th>
                <th style={{ ...s.th, textAlign: 'center' }}>Праг за аларм</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.id}>
                  <td style={{ ...s.td, fontWeight: 500 }}>
                    <span
                      style={{
                        display: 'inline-block',
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: c.color,
                        marginRight: 8,
                      }}
                    />
                    {c.name}
                  </td>
                  <td style={s.td}>
                    {c.calendarType === 'specificen' ? 'Специфичен' : 'Стандарден'}
                  </td>
                  <td style={{ ...s.td, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {c.videosPerMonth}
                  </td>
                  <td style={{ ...s.td, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {c.graphicsPerMonth}
                  </td>
                  <td style={{ ...s.td, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {c.coverageAlarmDays} дена
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const DEFAULTS: Record<'video' | 'graphic', { weekdays: number[]; publishTime: string }> = {
  video: { weekdays: [2, 5], publishTime: '10:00' },
  graphic: { weekdays: [1, 3, 5], publishTime: '12:00' },
};

/** Уредувач на СТАНДАРДНИОТ календар (clientId=null). Само АМ/Директор може да зачува. */
function StandardCalendarEditor() {
  const me = useMe().data;
  const { data, isLoading } = useStandardCalendar();
  const canEdit = me?.role === 'dir' || me?.role === 'am';

  return (
    <section style={{ marginBottom: 24 }}>
      <h3 style={{ fontSize: 15, fontWeight: 600, margin: '0 0 4px' }}>Стандарден календар</h3>
      <p style={{ fontSize: 13, color: 'var(--gd-ink-muted)', margin: '0 0 12px' }}>
        Важи за клиентите со тип „Стандарден". Посебните календари се менуваат кај клиентот.
      </p>
      {isLoading && <p style={{ color: 'var(--gd-ink-muted)' }}>Вчитување…</p>}
      {!isLoading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {(['video', 'graphic'] as const).map((ct) => (
            <ContentTypeRow
              key={ct}
              contentType={ct}
              config={data?.find((c) => c.contentType === ct) ?? null}
              canEdit={canEdit}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ContentTypeRow({
  contentType,
  config,
  canEdit,
}: {
  contentType: 'video' | 'graphic';
  config: CalendarConfigRow | null;
  canEdit: boolean;
}) {
  const save = useSaveStandardCalendar();
  const [weekdays, setWeekdays] = useState<number[]>(
    config?.weekdays ?? DEFAULTS[contentType].weekdays,
  );
  const [publishTime, setPublishTime] = useState(
    config?.publishTime ?? DEFAULTS[contentType].publishTime,
  );
  const [allowTwo, setAllowTwo] = useState(config?.allowTwoPerDay ?? false);
  const [toast, setToast] = useState<string | null>(null);

  // Кога ќе стигнат податоците од серверот, освежи ја локалната состојба.
  useEffect(() => {
    if (config) {
      setWeekdays(config.weekdays);
      setPublishTime(config.publishTime);
      setAllowTwo(config.allowTwoPerDay);
    }
  }, [config]);

  const toggle = (n: number) =>
    setWeekdays((w) =>
      w.includes(n) ? w.filter((x) => x !== n) : [...w, n].sort((a, b) => a - b),
    );

  const onSave = () => {
    if (!weekdays.length) {
      setToast('Избери барем еден ден.');
      return;
    }
    save.mutate(
      { contentType, weekdays, publishTime, allowTwoPerDay: allowTwo },
      {
        onSuccess: () => setToast('Зачувано.'),
        onError: (e) => setToast(e instanceof ApiRequestError ? e.message : 'Грешка.'),
      },
    );
  };

  return (
    <div style={rowCard}>
      <div style={{ fontWeight: 600, fontSize: 13, minWidth: 72 }}>
        {contentType === 'video' ? 'Видео' : 'Графика'}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {WEEKDAYS.map((d) => {
          const on = weekdays.includes(d.n);
          return (
            <button
              key={d.n}
              type="button"
              disabled={!canEdit}
              onClick={() => toggle(d.n)}
              style={dayChip(on, canEdit)}
            >
              {d.l}
            </button>
          );
        })}
      </div>
      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
        Време
        <input
          type="time"
          value={publishTime}
          disabled={!canEdit}
          onChange={(e) => setPublishTime(e.target.value)}
          style={timeInput}
        />
      </label>
      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input
          type="checkbox"
          checked={allowTwo}
          disabled={!canEdit}
          onChange={(e) => setAllowTwo(e.target.checked)}
        />
        2 по ден
      </label>
      {canEdit && (
        <Button variant="primary" size="toolbar" onClick={onSave} style={{ marginLeft: 'auto' }}>
          {save.isPending ? 'Се зачувува…' : 'Зачувај'}
        </Button>
      )}
      {toast && (
        <span style={{ fontSize: 12, color: 'var(--gd-ink-muted)', marginLeft: 8 }}>{toast}</span>
      )}
    </div>
  );
}

const rowCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  flexWrap: 'wrap',
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  padding: '10px 14px',
};
const dayChip = (on: boolean, enabled: boolean): React.CSSProperties => ({
  fontSize: 12,
  fontWeight: 500,
  padding: '4px 8px',
  borderRadius: 6,
  border: `1px solid ${on ? 'var(--gd-primary)' : 'var(--gd-border)'}`,
  background: on ? 'var(--gd-primary)' : 'transparent',
  color: on ? '#fff' : 'var(--gd-ink-secondary)',
  cursor: enabled ? 'pointer' : 'default',
});
const timeInput: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 6,
  padding: '3px 6px',
  fontSize: 13,
};
