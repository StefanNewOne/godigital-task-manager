import { ROLE_LABEL } from '@gd/core';
import { useEmployees } from '../../api/admin.js';
import { tableStyles as s } from '../../components/table.js';

export function AdminEmployees() {
  const { data, isLoading, error } = useEmployees();

  return (
    <div>
      <h1 style={s.h1}>Вработени и улоги</h1>
      {isLoading && <p style={{ color: 'var(--gd-ink-muted)' }}>Вчитување…</p>}
      {error && <p style={{ color: 'var(--gd-danger-text)' }}>Грешка при вчитување.</p>}
      {data && (
        <div style={s.wrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Име и е-мејл</th>
                <th style={s.th}>Улога</th>
                <th style={s.th}>Статус</th>
                <th style={s.th}>Последна активност</th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td style={s.td}>
                    <div style={{ fontWeight: 500 }}>{e.name}</div>
                    <div style={{ fontSize: 13, color: 'var(--gd-ink-muted)' }}>{e.email}</div>
                  </td>
                  <td style={s.td}>{ROLE_LABEL[e.role]}</td>
                  <td style={s.td}>{e.active ? 'Активен' : 'Неактивен'}</td>
                  <td style={s.td}>
                    {e.lastActiveAt ? new Date(e.lastActiveAt).toLocaleString('mk-MK') : '—'}
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
