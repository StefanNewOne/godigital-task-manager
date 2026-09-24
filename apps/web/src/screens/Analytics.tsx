import type React from 'react';
import { useState } from 'react';
import { Button } from '@gd/ui';
import { useMe } from '../api/auth.js';
import { useAnalytics, type AnalyticsCampaign, type AnalyticsPost } from '../api/analytics.js';
import { CampaignsManager } from './CampaignsManager.js';
import { ReportModal } from './ReportModal.js';

/**
 * Аналитика (Handoff §9). Распоредот е финален; бројките доаѓаат од `/analytics` (B2),
 * агрегирани од `MetricSnapshot` (Meta insights на секои 6ч). Празна состојба додека нема
 * снимени метрики за месецот.
 */
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const fmtNum = (n: number): string => {
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(Math.round(n));
};
const fmtEur = (n: number): string => `${Math.round(n).toLocaleString('mk-MK')} €`;
const fmtCpr = (n: number | null): string => (n == null ? '—' : `${n.toFixed(2)} €`);
const fmtDay = (iso: string): string => {
  const d = new Date(iso);
  return `${d.getUTCDate()}.${d.getUTCMonth() + 1}`;
};

export function Analytics() {
  const month = currentMonth();
  const { data, isLoading } = useAnalytics(month);
  const { data: me } = useMe();
  const [managing, setManaging] = useState(false);
  const [reporting, setReporting] = useState(false);
  const canManage = me?.role === 'ana' || me?.role === 'dir';
  const canReport = me?.role === 'ana' || me?.role === 'dir' || me?.role === 'am';

  const header = (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
      {canReport && (
        <Button variant="secondary" size="form" onClick={() => setReporting(true)}>
          Извештај
        </Button>
      )}
      {canManage && (
        <Button variant="secondary" size="form" onClick={() => setManaging(true)}>
          Кампањи
        </Button>
      )}
    </div>
  );
  const modals = (
    <>
      {managing && <CampaignsManager onClose={() => setManaging(false)} />}
      {reporting && <ReportModal month={month} onClose={() => setReporting(false)} />}
    </>
  );

  if (isLoading) {
    return (
      <div style={{ padding: '24px 20px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {header}
        <div style={{ color: 'var(--gd-ink-muted)' }}>Вчитување…</div>
        {modals}
      </div>
    );
  }

  if (!data || !data.hasData) {
    return (
      <div style={{ padding: '24px 20px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {header}
        <div style={emptyState} role="note">
          Сè уште нема снимени метрики за овој месец. Метриките се влечат автоматски од Meta по
          објавување (на секои 6 часа).
        </div>
        {modals}
      </div>
    );
  }

  const { kpis, split, campaigns, topPosts } = data;
  const kpiCards = [
    { label: 'Досег', value: fmtNum(kpis.reach), hint: `${fmtNum(kpis.impressions)} импресии` },
    { label: 'Прегледи', value: fmtNum(kpis.views), hint: '' },
    {
      label: 'Ангажман',
      value: fmtNum(kpis.engagement),
      hint: kpis.ctr != null ? `CTR ${kpis.ctr}%` : '',
    },
    { label: 'Потрошено', value: fmtEur(kpis.spend), hint: '' },
    { label: 'Цена по резултат', value: fmtCpr(kpis.cpr), hint: '' },
    {
      label: 'Објави',
      value: String(kpis.posts),
      hint: `${split.organicPosts} орг · ${split.paidPosts} плат`,
    },
  ];

  const totalReach = split.organicReach + split.paidReach;
  const orgPct = totalReach > 0 ? Math.round((split.organicReach / totalReach) * 100) : 0;
  const paidPct = 100 - orgPct;
  const maxPostReach = topPosts.reduce((m, p) => Math.max(m, p.reach), 0) || 1;

  return (
    <div style={{ padding: '24px 20px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {header}
      <div style={kpiGrid}>
        {kpiCards.map((k) => (
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
            <div style={{ width: `${orgPct}%`, background: '#0D9488' }} />
            <div style={{ width: `${paidPct}%`, background: '#DB2777' }} />
          </div>
          <Split
            color="#0D9488"
            title={`Органски · ${orgPct}%`}
            lines={[`${split.organicPosts} објави · досег ${fmtNum(split.organicReach)}`]}
          />
          <div style={{ height: 12 }} />
          <Split
            color="#DB2777"
            title={`Платено · ${paidPct}%`}
            lines={[
              `${split.paidPosts} објави · досег ${fmtNum(split.paidReach)}`,
              kpis.cpr != null
                ? `Просечна цена по резултат ${fmtCpr(kpis.cpr)}`
                : 'Нема платени резултати',
            ]}
          />
        </section>

        <section style={card}>
          <h2 style={{ ...cardTitle, margin: 0 }}>Кампањи во тек</h2>
          {campaigns.length === 0 ? (
            <p style={{ fontSize: 13, color: 'var(--gd-ink-muted)', marginTop: 12 }}>
              Нема активни кампањи во месецот.
            </p>
          ) : (
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {campaigns.map((c) => (
                <CampaignRow key={c.id} c={c} />
              ))}
            </div>
          )}
        </section>
      </div>

      <section style={card}>
        <h2 style={cardTitle}>Топ објави по ангажман</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {topPosts.map((p) => (
            <PostRow key={p.publicationId} p={p} maxReach={maxPostReach} />
          ))}
        </div>
      </section>
      {modals}
    </div>
  );
}

function CampaignRow({ c }: { c: AnalyticsCampaign }) {
  const pct = c.budget > 0 ? Math.min(100, (c.spent / c.budget) * 100) : 0;
  return (
    <div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontSize: 13,
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
          {c.name}
        </span>
        <span style={{ color: 'var(--gd-ink-muted)' }}>
          {fmtDay(c.periodFrom)}–{fmtDay(c.periodTo)}
        </span>
      </div>
      <div style={barTrack}>
        <div style={{ height: '100%', width: `${pct}%`, background: c.color }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)', marginTop: 4 }}>
        {fmtEur(c.spent)} од {fmtEur(c.budget)} · досег {fmtNum(c.reach)} · цена/резултат{' '}
        {fmtCpr(c.cpr)}
      </div>
    </div>
  );
}

function PostRow({ p, maxReach }: { p: AnalyticsPost; maxReach: number }) {
  const pct = Math.round((p.reach / maxReach) * 100);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
        <div style={{ height: '100%', width: `${pct}%`, background: p.color }} />
      </div>
      <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)', marginTop: 4, textAlign: 'right' }}>
        досег {fmtNum(p.reach)} · ангажман {fmtNum(p.engagement)}
        {p.rate != null ? ` · ${p.rate}%` : ''}
      </div>
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

const emptyState: React.CSSProperties = {
  background: 'var(--gd-surface)',
  border: '1px dashed var(--gd-border)',
  borderRadius: 8,
  padding: '24px',
  fontSize: 14,
  color: 'var(--gd-ink-muted)',
  textAlign: 'center',
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
