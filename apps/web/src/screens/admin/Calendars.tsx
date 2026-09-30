import { t } from '@gd/ui';
import { useClients } from '../../api/admin.js';
import { tableStyles as s } from '../../components/table.js';

/**
 * Админ → Календари: read-only преглед на режимот по клиент. Уредувањето на календарите
 * (стандарден + посебен по клиент) е на екранот „Календар" → „Календарски поставки" (АМ/Директор).
 */
export function AdminCalendars() {
  const { data: clients, isLoading } = useClients();

  return (
    <div>
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
        {t('admin.calBannerPre')}
        <strong>{t('admin.calBannerBold')}</strong>
        {t('admin.calBannerPost')}
      </div>

      {isLoading && <p style={{ color: 'var(--gd-ink-muted)' }}>{t('admin.loading')}</p>}
      {clients && (
        <div style={s.wrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>{t('admin.calColClient')}</th>
                <th style={s.th}>{t('admin.calColType')}</th>
                <th style={{ ...s.th, textAlign: 'center' }}>{t('admin.calColVideo')}</th>
                <th style={{ ...s.th, textAlign: 'center' }}>{t('admin.calColGraphic')}</th>
                <th style={{ ...s.th, textAlign: 'center' }}>{t('admin.calColThreshold')}</th>
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
                    {c.calendarType === 'specificen'
                      ? t('admin.calSpecific')
                      : t('admin.calStandard')}
                  </td>
                  <td style={{ ...s.td, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {c.videosPerMonth}
                  </td>
                  <td style={{ ...s.td, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {c.graphicsPerMonth}
                  </td>
                  <td style={{ ...s.td, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                    {t('plural.day', { count: c.coverageAlarmDays })}
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
