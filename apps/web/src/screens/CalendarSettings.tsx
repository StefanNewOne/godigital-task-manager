import type React from 'react';
import { useEffect, useState } from 'react';
import { Button } from '@gd/ui';
import {
  useSaveStandardCalendar,
  useStandardCalendar,
  type CalendarConfigInput as StdInput,
} from '../api/calendar.js';
import {
  useCalendarConfig,
  useSaveCalendarConfig,
  type CalendarConfigInput,
  type CalendarConfigRow,
} from '../api/slots.js';
import { ApiRequestError } from '../lib/api.js';

const WEEKDAYS: Array<{ n: number; l: string }> = [
  { n: 1, l: 'Пон' },
  { n: 2, l: 'Вто' },
  { n: 3, l: 'Сре' },
  { n: 4, l: 'Чет' },
  { n: 5, l: 'Пет' },
  { n: 6, l: 'Саб' },
  { n: 7, l: 'Нед' },
];
const DEFAULTS: Record<'video' | 'graphic', { weekdays: number[]; publishTime: string }> = {
  video: { weekdays: [2, 5], publishTime: '10:00' },
  graphic: { weekdays: [1, 3, 5], publishTime: '12:00' },
};

/** Уредувач на календар (АМ/Директор): стандарден + посебен по клиент. */
export function CalendarSettings({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName?: string;
}) {
  const std = useStandardCalendar();
  const perClient = useCalendarConfig(clientId || null);
  const [toast, setToast] = useState<string | null>(null);

  return (
    <div style={panel}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <h3 style={h3}>Стандарден календар</h3>
          <p style={hint}>Важи за клиентите со тип „Стандарден".</p>
          {(['video', 'graphic'] as const).map((ct) => (
            <StandardRow
              key={ct}
              contentType={ct}
              config={std.data?.find((c) => c.contentType === ct) ?? null}
              onToast={setToast}
            />
          ))}
        </div>

        {clientId && (
          <div>
            <h3 style={h3}>Посебен календар · {clientName ?? 'клиент'}</h3>
            <p style={hint}>Го заменува стандардниот само за овој клиент.</p>
            {(['video', 'graphic'] as const).map((ct) => (
              <ClientRow
                key={ct}
                clientId={clientId}
                contentType={ct}
                config={perClient.data?.find((c) => c.contentType === ct) ?? null}
                onToast={setToast}
              />
            ))}
          </div>
        )}
      </div>
      {toast && (
        <span style={{ fontSize: 12, color: 'var(--gd-ink-muted)', marginTop: 8 }}>{toast}</span>
      )}
    </div>
  );
}

function StandardRow({
  contentType,
  config,
  onToast,
}: {
  contentType: 'video' | 'graphic';
  config: { weekdays: number[]; publishTime: string; allowTwoPerDay: boolean } | null;
  onToast: (s: string) => void;
}) {
  const save = useSaveStandardCalendar();
  return (
    <WeekdayRow
      contentType={contentType}
      config={config}
      pending={save.isPending}
      onSave={(input) =>
        save.mutate(input as StdInput, {
          onSuccess: () => onToast('Стандардниот календар е зачуван.'),
          onError: (e) => onToast(e instanceof ApiRequestError ? e.message : 'Грешка.'),
        })
      }
    />
  );
}

function ClientRow({
  clientId,
  contentType,
  config,
  onToast,
}: {
  clientId: string;
  contentType: 'video' | 'graphic';
  config: CalendarConfigRow | null;
  onToast: (s: string) => void;
}) {
  const save = useSaveCalendarConfig(clientId);
  return (
    <WeekdayRow
      contentType={contentType}
      config={
        config
          ? {
              weekdays: config.weekdays,
              publishTime: config.publishTime ?? DEFAULTS[contentType].publishTime,
              allowTwoPerDay: config.allowTwoPerDay ?? false,
            }
          : null
      }
      pending={save.isPending}
      onSave={(input) =>
        save.mutate(input as CalendarConfigInput, {
          onSuccess: () => onToast('Посебниот календар е зачуван.'),
          onError: (e) => onToast(e instanceof ApiRequestError ? e.message : 'Грешка.'),
        })
      }
    />
  );
}

function WeekdayRow({
  contentType,
  config,
  pending,
  onSave,
}: {
  contentType: 'video' | 'graphic';
  config: { weekdays: number[]; publishTime: string; allowTwoPerDay: boolean } | null;
  pending: boolean;
  onSave: (input: {
    contentType: 'video' | 'graphic';
    weekdays: number[];
    publishTime: string;
    allowTwoPerDay: boolean;
  }) => void;
}) {
  const [weekdays, setWeekdays] = useState<number[]>(
    config?.weekdays ?? DEFAULTS[contentType].weekdays,
  );
  const [publishTime, setPublishTime] = useState(
    config?.publishTime ?? DEFAULTS[contentType].publishTime,
  );
  const [allowTwo, setAllowTwo] = useState(config?.allowTwoPerDay ?? false);

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

  return (
    <div style={row}>
      <div style={{ fontWeight: 600, fontSize: 13, minWidth: 64 }}>
        {contentType === 'video' ? 'Видео' : 'Графика'}
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {WEEKDAYS.map((d) => {
          const on = weekdays.includes(d.n);
          return (
            <button key={d.n} type="button" onClick={() => toggle(d.n)} style={chip(on)}>
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
          onChange={(e) => setPublishTime(e.target.value)}
          style={timeInput}
        />
      </label>
      <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
        <input type="checkbox" checked={allowTwo} onChange={(e) => setAllowTwo(e.target.checked)} />
        2 по ден
      </label>
      <Button
        variant="primary"
        size="toolbar"
        style={{ marginLeft: 'auto' }}
        disabled={pending || !weekdays.length}
        onClick={() => onSave({ contentType, weekdays, publishTime, allowTwoPerDay: allowTwo })}
      >
        {pending ? 'Се зачувува…' : 'Зачувај'}
      </Button>
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
const h3: React.CSSProperties = { fontSize: 14, fontWeight: 600, margin: '0 0 2px' };
const hint: React.CSSProperties = { fontSize: 12, color: 'var(--gd-ink-muted)', margin: '0 0 8px' };
const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  flexWrap: 'wrap',
  padding: '8px 0',
  borderTop: '1px solid var(--gd-border)',
};
const chip = (on: boolean): React.CSSProperties => ({
  fontSize: 12,
  fontWeight: 500,
  padding: '4px 8px',
  borderRadius: 6,
  border: `1px solid ${on ? 'var(--gd-primary)' : 'var(--gd-border)'}`,
  background: on ? 'var(--gd-primary)' : 'transparent',
  color: on ? '#fff' : 'var(--gd-ink-secondary)',
  cursor: 'pointer',
});
const timeInput: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 6,
  padding: '3px 6px',
  fontSize: 13,
};
