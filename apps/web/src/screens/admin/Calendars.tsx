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
        Календарите (стандарден и посебен по клиент) се уредуваат во екранот{' '}
        <strong>Календар → Календарски поставки</strong>. Слотовите се генерираат автоматски на
        20-ти (06:00, Europe/Skopje); Акаунт менаџерот потврдува месец во истиот екран.
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
