import { useRules, useToggleRule } from '../../api/notifications.js';
import { tableStyles as s } from '../../components/table.js';

/** Админ → Аларми (H3 минимум): системски правила со on/off toggle. Rule Builder = Фаза B1. */
export function AdminAlarms() {
  const { data: rules, isLoading } = useRules();
  const toggle = useToggleRule();

  return (
    <div>
      <p style={{ color: 'var(--gd-ink-muted)', fontSize: 13, marginTop: -8, marginBottom: 16 }}>
        Системските правила за известувања — вклучи или исклучи по потреба.
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
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <button
                        onClick={() => toggle.mutate(r.id)}
                        disabled={toggle.isPending}
                        role="switch"
                        aria-checked={r.enabled}
                        aria-label={r.name}
                        style={{
                          width: 40,
                          height: 22,
                          borderRadius: 9999,
                          border: 'none',
                          padding: 2,
                          display: 'flex',
                          justifyContent: r.enabled ? 'flex-end' : 'flex-start',
                          background: r.enabled ? 'var(--gd-primary)' : 'var(--gd-border)',
                          cursor: 'pointer',
                          transition: 'background 150ms',
                        }}
                      >
                        <span
                          style={{
                            width: 18,
                            height: 18,
                            borderRadius: '50%',
                            background: '#fff',
                            boxShadow: '0 1px 2px rgba(0,0,0,.2)',
                          }}
                        />
                      </button>
                      <span style={{ fontSize: 12, color: 'var(--gd-ink-muted)', width: 64 }}>
                        {r.enabled ? 'Вклучено' : 'Исклучено'}
                      </span>
                    </div>
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
