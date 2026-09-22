/** Аналитика — празна состојба до Фаза B2 (Meta метрики). */
export function Analytics() {
  return (
    <div style={{ padding: '24px 20px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>Аналитика</h1>
      <div
        style={{
          marginTop: 16,
          padding: 32,
          textAlign: 'center',
          border: '1px dashed var(--gd-border)',
          borderRadius: 8,
          background: 'var(--gd-surface)',
          color: 'var(--gd-ink-muted)',
        }}
      >
        Метриките се вклучуваат во Фаза B2 (влечење од Meta на секои 6 часа).
      </div>
    </div>
  );
}
