import { useClients } from '../../api/admin.js';
import { tableStyles as s } from '../../components/table.js';

export function AdminClients() {
  const { data, isLoading, error } = useClients();

  return (
    <div>
      <h1 style={s.h1}>Клиенти</h1>
      {isLoading && <p style={{ color: 'var(--gd-ink-muted)' }}>Вчитување…</p>}
      {error && <p style={{ color: 'var(--gd-danger-text)' }}>Грешка при вчитување.</p>}
      {data && (
        <div style={s.wrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Клиент</th>
                <th style={s.th}>Видео/мес</th>
                <th style={s.th}>Графика/мес</th>
                <th style={s.th}>Meta Ads</th>
                <th style={s.th}>Канал</th>
                <th style={s.th}>Календар</th>
              </tr>
            </thead>
            <tbody>
              {data.map((c) => (
                <tr key={c.id}>
                  <td style={s.td}>
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
                  <td style={s.td}>{c.videosPerMonth}</td>
                  <td style={s.td}>{c.graphicsPerMonth}</td>
                  <td style={s.td}>{c.usesMetaAds ? 'Да' : '—'}</td>
                  <td style={s.td}>{c.approvalChannel}</td>
                  <td style={s.td}>{c.calendarType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
