import { PERMISSIONS, ROLE_LABEL, ROLES, SCREENS, type Screen } from '@gd/core';
import { t } from '@gd/ui';
import { tableStyles as s } from '../../components/table.js';

const SCREEN_LABEL: Record<Screen, string> = {
  director: t('admin.scrDirector'),
  list: t('admin.scrList'),
  calendar: t('admin.scrCalendar'),
  shootCalendar: t('admin.scrShoot'),
  clients: t('admin.scrClients'),
  analytics: t('admin.scrAnalytics'),
  admin: t('admin.scrAdmin'),
  crm: t('admin.scrCrm'),
  meta: t('admin.scrMeta'),
};

export function AdminPermissions() {
  return (
    <div>
      <p style={{ color: 'var(--gd-ink-muted)', fontSize: 13, marginTop: 0, marginBottom: 16 }}>
        {t('admin.permLegend')}
      </p>
      <div style={s.wrap}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>{t('admin.colRole')}</th>
              <th style={s.th}>{t('admin.colScope')}</th>
              {SCREENS.map((sc) => (
                <th key={sc} style={{ ...s.th, textAlign: 'center' }}>
                  {SCREEN_LABEL[sc]}
                </th>
              ))}
              <th style={s.th}>{t('admin.colOwns')}</th>
            </tr>
          </thead>
          <tbody>
            {ROLES.map((role) => {
              const p = PERMISSIONS[role];
              return (
                <tr key={role}>
                  <td style={{ ...s.td, fontWeight: 500 }}>{ROLE_LABEL[role]}</td>
                  <td style={s.td}>
                    {p.scope === 'all' ? t('admin.scopeAll') : t('admin.scopeOwn')}
                  </td>
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
