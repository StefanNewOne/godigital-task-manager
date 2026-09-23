import type React from 'react';

/**
 * Аналитика (Handoff §9). Распоредот е финален; бројките се ИЛУСТРАТИВНИ до Фаза B2
 * (реалните Meta метрики се влечат на секои 6 часа во `MetricSnapshot`). Кога B2 ќе се
 * вклучи, овие картички се хранат од `/analytics`, без промена на распоредот.
 */
const KPIS = [
  { label: 'Досег', value: '586k', hint: '+12% од август' },
  { label: 'Прегледи', value: '405k', hint: '+8% од август' },
  { label: 'Ангажман', value: '21.1k', hint: '−3% од август' },
  { label: 'Потрошено', value: '1.530 €', hint: 'од 1.800 € буџет' },
  { label: 'Цена по резултат', value: '0.34 €', hint: '−0.06 € од август' },
  { label: 'Објави', value: '58', hint: '22 видео · 36 графика' },
];

const CAMPAIGNS = [
  {
    name: 'Астибо · Есенска колекција',
    color: '#D97706',
    period: '15–30 сеп',
    spent: 286,
    budget: 450,
    reach: '84.2k',
    cpr: '0.31 €',
  },
  {
    name: 'Алекс Дизајн · Лежај Ена',
    color: '#DB2777',
    period: '10–25 сеп',
    spent: 241,
    budget: 300,
    reach: '61.7k',
    cpr: '0.44 €',
  },
  {
    name: 'Голд Хотел · Викенд пакет',
    color: '#0EA5E9',
    period: '18 сеп – 2 окт',
    spent: 132,
    budget: 600,
    reach: '22.4k',
    cpr: '0.58 €',
  },
];

const TOP_POSTS = [
  {
    name: 'Алекс дизајн пост 5 · Лежај Ена',
    color: '#DB2777',
    paid: true,
    pct: 96,
    reach: '61.7k',
    eng: '4.4k',
    rate: '7.1%',
  },
  {
    name: 'Астибо V-9-5 · Есенска колекција',
    color: '#D97706',
    paid: true,
    pct: 86,
    reach: '54.2k',
    eng: '3.8k',
    rate: '7.0%',
  },
  {
    name: 'Ресторан ИВ G-9-9-агенда',
    color: '#0D9488',
    paid: false,
    pct: 62,
    reach: '28.4k',
    eng: '2.1k',
    rate: '7.4%',
  },
  {
    name: 'ЛЛ Гурмет пост 5',
    color: '#65A30D',
    paid: false,
    pct: 52,
    reach: '19.8k',
    eng: '1.2k',
    rate: '6.1%',
  },
];

export function Analytics() {
  return (
    <div style={{ padding: '24px 20px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Чесен маркер: ова се демонстративни бројки додека Meta интеграцијата (Фаза B2) не влезе. */}
      <div style={demoBanner} role="note">
        Демонстративни податоци — реалните метрики се влечат од Meta во Фаза B2. Распоредот е
        финален.
      </div>

      {/* KPI картички */}
      <div style={kpiGrid}>
        {KPIS.map((k) => (
          <div key={k.label} style={card}>
            <div style={{ fontSize: 13, color: 'var(--gd-ink-muted)' }}>{k.label}</div>
            <div
              style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', margin: '4px 0' }}
            >
              {k.value}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>{k.hint}</div>
          </div>
        ))}
      </div>

      {/* Органски наспроти платено + Кампањи во тек */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
          gap: 16,
        }}
      >
        <section style={card}>
          <h2 style={cardTitle}>Органски наспроти платено</h2>
          <div
            style={{
              display: 'flex',
              height: 10,
              borderRadius: 9999,
              overflow: 'hidden',
              margin: '4px 0 16px',
            }}
          >
            <div style={{ width: '62%', background: '#0D9488' }} />
            <div style={{ width: '38%', background: '#DB2777' }} />
          </div>
          <Split
            color="#0D9488"
            title="Органски · 62%"
            lines={['36 објави · досег 364k', 'Просечен ангажман 3.1%']}
          />
          <div style={{ height: 12 }} />
          <Split
            color="#DB2777"
            title="Платено · 38%"
            lines={['22 објави · досег 222k', 'Просечна цена по резултат 0.34 €']}
          />
        </section>

        <section style={card}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ ...cardTitle, margin: 0 }}>Кампањи во тек</h2>
            <span style={{ fontSize: 13, color: 'var(--gd-primary)', fontWeight: 500 }}>
              Цела аналитика ›
            </span>
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {CAMPAIGNS.map((c) => (
              <div key={c.name}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: 13,
                  }}
                >
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      fontWeight: 500,
                    }}
                  >
                    <span
                      style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }}
                    />
                    {c.name}
                  </span>
                  <span style={{ color: 'var(--gd-ink-muted)' }}>{c.period}</span>
                </div>
                <div style={barTrack}>
                  <div
                    style={{
                      height: '100%',
                      width: `${(c.spent / c.budget) * 100}%`,
                      background: c.color,
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)', marginTop: 4 }}>
                  {c.spent} € од {c.budget} € · досег {c.reach} · цена/резултат {c.cpr}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* Топ објави по ангажман */}
      <section style={card}>
        <h2 style={cardTitle}>Топ објави по ангажман</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {TOP_POSTS.map((p) => (
            <div key={p.name}>
              <div
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
              >
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                >
                  <span style={{ width: 3, height: 16, borderRadius: 2, background: p.color }} />
                  {p.name}
                </span>
                <span style={tag}>{p.paid ? 'Платено' : 'Органски'}</span>
              </div>
              <div style={{ ...barTrack, height: 8, marginTop: 6 }}>
                <div style={{ height: '100%', width: `${p.pct}%`, background: p.color }} />
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--gd-ink-muted)',
                  marginTop: 4,
                  textAlign: 'right',
                }}
              >
                досег {p.reach} · ангажман {p.eng} · {p.rate}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Split({ color, title, lines }: { color: string; title: string; lines: string[] }) {
  return (
    <div style={{ display: 'flex', gap: 8 }}>
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
          marginTop: 4,
          flex: '0 0 auto',
        }}
      />
      <div>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{title}</div>
        {lines.map((l) => (
          <div key={l} style={{ fontSize: 13, color: 'var(--gd-ink-muted)' }}>
            {l}
          </div>
        ))}
      </div>
    </div>
  );
}

const demoBanner: React.CSSProperties = {
  background: 'var(--gd-warning-tint, #FEF3C7)',
  border: '1px solid var(--gd-warning, #D97706)',
  color: 'var(--gd-warning-text, #92400E)',
  borderRadius: 8,
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 500,
};
const kpiGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
  gap: 16,
};
const card: React.CSSProperties = {
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  padding: 16,
};
const cardTitle: React.CSSProperties = {
  fontSize: 16,
  lineHeight: '24px',
  fontWeight: 600,
  margin: '0 0 8px',
};
const barTrack: React.CSSProperties = {
  height: 6,
  borderRadius: 9999,
  background: 'var(--gd-surface-alt)',
  overflow: 'hidden',
  marginTop: 6,
};
const tag: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--gd-ink-muted)',
  background: 'var(--gd-surface-alt)',
  border: '1px solid var(--gd-border)',
  borderRadius: 9999,
  padding: '1px 8px',
};
