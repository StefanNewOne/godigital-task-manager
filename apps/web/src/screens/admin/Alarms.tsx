import { useRules, useToggleRule } from '../../api/notifications.js';
import { tableStyles as s } from '../../components/table.js';

/** Админ → Аларми (H3 минимум): системски правила со on/off toggle. Rule Builder = Фаза B1. */
export function AdminAlarms() {
  const { data: rules, isLoading } = useRules();
  const toggle = useToggleRule();

  return (
    <div>
      <h1 style={s.h1}>Аларми</h1>
      <p style={{ color: 'var(--gd-ink-muted)', fontSize: 13, marginTop: -8, marginBottom: 16 }}>
        Системските правила (PRD §13) со вклучување/исклучување. Rule Builder форма доаѓа во Фаза
        B1.
      </p>
      {isLoading && <p style={{ color: 'var(--gd-ink-muted)' }}>Вчитување…</p>}
      {rules && (
        <div style={s.wrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Правило</th>
                <th style={s.th}>Опсег</th>
                <th style={s.th}>Тип</th>
                <th style={{ ...s.th, textAlign: 'right' }}>Состојба</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.id}>
                  <td style={{ ...s.td, fontWeight: 500 }}>{r.name}</td>
                  <td style={s.td}>{r.scope === 'global' ? 'Глобално' : 'По клиент'}</td>
                  <td style={s.td}>{r.isSystem ? 'Системско' : 'Прилагодено'}</td>
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    <button
                      onClick={() => toggle.mutate(r.id)}
                      disabled={toggle.isPending}
                      style={{
                        height: 26,
                        padding: '0 12px',
                        borderRadius: 9999,
                        border: '1px solid var(--gd-border)',
                        cursor: 'pointer',
                        background: r.enabled ? 'var(--gd-success)' : 'var(--gd-surface-alt)',
                        color: r.enabled ? '#fff' : 'var(--gd-ink-muted)',
                        fontSize: 12,
                        fontWeight: 500,
                      }}
                    >
                      {r.enabled ? 'Вклучено' : 'Исклучено'}
                    </button>
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
