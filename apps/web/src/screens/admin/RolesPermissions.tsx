import { PERMISSIONS, ROLE_LABEL, ROLES, SCREENS, type Screen } from '@gd/core';
import { tableStyles as s } from '../../components/table.js';

const SCREEN_LABEL: Record<Screen, string> = {
  director: 'Преглед',
  list: 'Задачи',
  calendar: 'Календар',
  clients: 'Клиенти',
  analytics: 'Аналитика',
  admin: 'Админ',
};

export function AdminPermissions() {
  return (
    <div>
      <h1 style={s.h1}>Улоги и дозволи</h1>
      <p style={{ color: 'var(--gd-ink-muted)', fontSize: 13, marginTop: -8, marginBottom: 16 }}>
        Читливо (извор: <code>@gd/core/permissions</code>). П = гледа екран · Ч = чита само свои.
      </p>
      <div style={s.wrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Улога</th>
              <th style={s.th}>Опсег</th>
              {SCREENS.map((sc) => (
                <th key={sc} style={{ ...s.th, textAlign: 'center' }}>
                  {SCREEN_LABEL[sc]}
                </th>
              ))}
              <th style={s.th}>Носи статуси</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => {
              const p = PERMISSIONS[role];
              return (
                <tr key={role}>
                  <td style={{ ...s.td, fontWeight: 500 }}>{ROLE_LABEL[role]}</td>
                  <td style={s.td}>{p.scope === 'all' ? 'Сите' : 'Свои'}</td>
                  {SCREENS.map((sc) => (
                    <td key={sc} style={{ ...s.td, textAlign: 'center' }}>
                      {p.nav.includes(sc) ? (
                        <span style={{ color: 'var(--gd-success-text)' }}>П</span>
                      ) : (
                        <span style={{ color: 'var(--gd-ink-muted)' }}>—</span>
                      )}
                    </td>
                  ))}
                  <td style={{ ...s.td, fontSize: 13, color: 'var(--gd-ink-secondary)' }}>
                    {[...p.ownsTaskStatuses, ...p.ownsCapaStatuses].join(', ') || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
