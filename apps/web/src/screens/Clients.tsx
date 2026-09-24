import type React from 'react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { daysLabel } from '../lib/format.js';
import { useClients } from '../api/admin.js';
import { useOverview } from '../api/overview.js';
import { useTasks } from '../api/tasks.js';
import { PeriodSidebar } from '../components/PeriodSidebar.js';
import { tableStyles as s } from '../components/table.js';

const LEVEL_COLOR: Record<string, string> = {
  ok: 'var(--gd-success-text)',
  warn: 'var(--gd-warning-text)',
  danger: 'var(--gd-danger-text)',
};
const CHANNEL_LABEL: Record<string, string> = {
  viber: 'Viber',
  whatsapp: 'WhatsApp',
  email: 'Мејл',
};
// Активен таск = не резервиран и не терминален.
const INACTIVE = new Set(['mrtov', 'objaveno', 'zavrseno', 'otkazano', 'pauza']);

/** Клиенти (Handoff §2.8): преглед по клиент со покриеност; ред отвора Список. */
export function Clients() {
  const { data: clients, isLoading } = useClients();
  const { data: overview } = useOverview();
  const { data: tasks } = useTasks({});
  const navigate = useNavigate();

  const cov = (id: string) => overview?.coverage.find((c) => c.clientId === id);
  const activeCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks ?? []) {
      if (INACTIVE.has(t.status)) continue;
      m.set(t.clientId, (m.get(t.clientId) ?? 0) + 1);
    }
    return m;
  }, [tasks]);

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <PeriodSidebar />
      <div style={{ flex: 1, minWidth: 0, overflow: 'auto', padding: '24px 20px' }}>
        {isLoading && <p style={{ color: 'var(--gd-ink-muted)' }}>Вчитување…</p>}
        {clients && (
          <div style={s.wrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Клиент</th>
                  <th style={s.th}>Видео/мес</th>
                  <th style={s.th}>Графика/мес</th>
                  <th style={s.th}>Активни таскови</th>
                  <th style={s.th}>Покриеност</th>
                  <th style={s.th}>Канал</th>
                </tr>
              </thead>
              <tbody>
                {[...clients]
                  .sort((a, b) => (cov(a.id)?.days ?? Infinity) - (cov(b.id)?.days ?? Infinity))
                  .map((c) => {
                    const cv = cov(c.id);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => navigate(`/tasks?client=${c.id}&tab=list`)}
                        style={clickRow}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = 'var(--gd-surface-alt)')
                        }
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td
                          style={{
                            ...s.td,
                            borderLeft: `4px solid ${c.color}`,
                          }}
                        >
                          <span style={dot(c.color)} />
                          {c.name}
                        </td>
                        <td style={{ ...s.td, ...tabular }}>{c.videosPerMonth}</td>
                        <td style={{ ...s.td, ...tabular }}>{c.graphicsPerMonth}</td>
                        <td style={{ ...s.td, ...tabular }}>{activeCount.get(c.id) ?? 0}</td>
                        <td
                          style={{
                            ...s.td,
                            ...tabular,
                            color: cv ? LEVEL_COLOR[cv.level] : undefined,
                            fontWeight: 600,
                          }}
                        >
                          {cv ? daysLabel(cv.days) : '—'}
                        </td>
                        <td style={s.td}>
                          {CHANNEL_LABEL[c.approvalChannel] ?? c.approvalChannel}
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

const tabular: React.CSSProperties = { fontVariantNumeric: 'tabular-nums' };
const clickRow: React.CSSProperties = { cursor: 'pointer' };
const dot = (color: string): React.CSSProperties => ({
  display: 'inline-block',
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: color,
  marginRight: 8,
});
