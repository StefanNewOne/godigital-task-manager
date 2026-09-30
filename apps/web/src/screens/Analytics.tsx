import type React from 'react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, t } from '@gd/ui';
import { ChevronDown, ChevronRight, Megaphone } from 'lucide-react';
import { useMe } from '../api/auth.js';
import { useClients } from '../api/admin.js';
import { useClientAnalytics, type AdNode, type ClientAnalytics } from '../api/analytics.js';
import { ReportModal } from './ReportModal.js';

/**
 * Аналитика (редизајн, Handoff §9). Избор на КЛИЕНТ + ПЕРИОД; метриките поделени по извор
 * (Instagram · Facebook · Реклами) со разбивка по месец. IG/FB од снимени метрики (cron на 6ч
 * + рачно копче), рекламите во живо од Meta (кампања→adset→ад).
 */
const MK_MONTHS = [
  'Јан',
  'Фев',
  'Мар',
  'Апр',
  'Мај',
  'Јун',
  'Јул',
  'Авг',
  'Сеп',
  'Окт',
  'Ное',
  'Дек',
];
function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}
const fmtNum = (n: number | null | undefined): string => {
  if (n == null) return '—';
  if (n >= 1000) {
    const k = n / 1000;
    return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, '')}k`;
  }
  return String(Math.round(n));
};
const fmtEur = (n: number): string => `${Math.round(n).toLocaleString('mk-MK')} €`;
const monthLabel = (mk: string): string => {
  const [y, m] = mk.split('-');
  return `${MK_MONTHS[Number(m) - 1] ?? m} ${y?.slice(2)}`;
};

/** CSV ќелија: наводници + escape (за Excel; со BOM за кирилица). */
const cell = (v: string | number | null): string => {
  const s = v == null ? '' : String(v);
  return `"${s.replace(/"/g, '""')}"`;
};

/** Изгради CSV од целата клиент+период аналитика (Instagram · Facebook · Реклами). */
function buildClientCsv(d: ClientAnalytics): string {
  const rows: string[] = [];
  const line = (...cells: Array<string | number | null>) => rows.push(cells.map(cell).join(','));
  line(t('analytics.csvClient'), d.clientName);
  line(t('analytics.csvPeriod'), `${d.from} - ${d.to}`);
  line('');

  line(t('analytics.csvIgSection'));
  line(
    t('analytics.csvType'),
    t('analytics.kPosts'),
    t('analytics.kReach'),
    t('analytics.kEngagement'),
    t('analytics.kViews'),
  );
  for (const k of d.instagram.byKind) {
    line(
      k.kind === 'video' ? t('analytics.kVideo') : t('analytics.kImage'),
      k.posts,
      k.reach,
      k.engagement,
      k.views,
    );
  }
  line('');
  line(
    t('analytics.csvIgByMonth'),
    t('analytics.kReach'),
    t('analytics.kEngagement'),
    t('analytics.kViews'),
    t('analytics.kPosts'),
  );
  for (const m of d.instagram.byMonth) {
    line(m.month, m.reach, m.engagement, m.views, m.posts);
  }
  line('');

  line(t('analytics.csvFbSection'));
  line(
    t('analytics.colMonth'),
    t('analytics.colFollowers'),
    t('analytics.kEngagement'),
    t('analytics.kViews'),
    t('analytics.colNew'),
    t('analytics.kVideo'),
    t('analytics.colReactions'),
  );
  for (const m of d.facebook.byMonth) {
    line(m.month, m.followers, m.engagement, m.pageViews, m.newFollows, m.videoViews, m.reactions);
  }
  line('');

  line(t('analytics.csvAdsSection'));
  line(
    t('analytics.csvLevel'),
    t('analytics.csvName'),
    t('analytics.kSpend'),
    t('analytics.kReach'),
    t('analytics.kImpressions'),
    'CTR %',
  );
  const walk = (node: AdNode, level: string) => {
    line(level, node.name, Math.round(node.spend), node.reach, node.impressions, node.ctr ?? '');
    for (const ch of node.children ?? []) {
      walk(
        ch,
        level === t('analytics.csvCampaign') ? t('analytics.csvAudience') : t('analytics.csvAd'),
      );
    }
  };
  for (const c of d.ads.campaigns) walk(c, t('analytics.csvCampaign'));
  return rows.join('\r\n');
}

function downloadClientCsv(d: ClientAnalytics): void {
  const blob = new Blob(['﻿' + buildClientCsv(d)], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `analitika-${d.clientName}-${d.from}_${d.to}.csv`.replace(/\s+/g, '-');
  a.click();
  URL.revokeObjectURL(url);
}

export function Analytics() {
  const { data: me } = useMe();
  const { data: clients } = useClients();
  const [clientId, setClientId] = useState('');
  const [from, setFrom] = useState(currentMonth());
  const [to, setTo] = useState(currentMonth());
  const [reporting, setReporting] = useState(false);

  // Default клиент = прв во листата.
  useEffect(() => {
    if (!clientId && clients && clients.length) setClientId(clients[0]!.id);
  }, [clients, clientId]);

  const { data, isLoading, isError } = useClientAnalytics(clientId, from, to);
  const canReport = me?.role === 'ana' || me?.role === 'dir' || me?.role === 'am';
  const canOpenMeta = me?.role === 'ana' || me?.role === 'dir';

  return (
    <div style={{ padding: '24px 20px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Контроли */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <select
          className="gd-field"
          style={{ width: 220, height: 36 }}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          {(clients ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          {t('analytics.from')}
          <input
            type="month"
            className="gd-field"
            style={{ height: 36 }}
            value={from}
            max={to}
            onChange={(e) => setFrom(e.target.value)}
          />
        </label>
        <label style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
          {t('analytics.to')}
          <input
            type="month"
            className="gd-field"
            style={{ height: 36 }}
            value={to}
            min={from}
            onChange={(e) => setTo(e.target.value)}
          />
        </label>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          {data && (
            <Button variant="secondary" size="form" onClick={() => downloadClientCsv(data)}>
              {t('analytics.downloadCsv')}
            </Button>
          )}
          {canReport && (
            <Button variant="secondary" size="form" onClick={() => setReporting(true)}>
              {t('analytics.monthlyReport')}
            </Button>
          )}
        </div>
      </div>

      {/* Детален оперативен преглед на рекламите е во модулот Мета (D7). */}
      {canOpenMeta && (
        <Link
          to="/meta"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            textDecoration: 'none',
            color: 'inherit',
            background: 'var(--gd-surface)',
            border: '1px solid var(--gd-border)',
            borderRadius: 8,
            padding: '14px 16px',
          }}
        >
          <Megaphone size={20} color="#0866FF" />
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>{t('analytics.openMeta')}</div>
            <div style={muted}>{t('analytics.openMetaDesc')}</div>
          </div>
          <ChevronRight size={18} color="var(--gd-ink-muted)" />
        </Link>
      )}

      {isLoading && <div style={{ color: 'var(--gd-ink-muted)' }}>{t('analytics.loading')}</div>}
      {isError && <div style={emptyState}>{t('analytics.error')}</div>}
      {data && <ClientAnalyticsView data={data} />}

      {reporting && <ReportModal from={from} to={to} onClose={() => setReporting(false)} />}
    </div>
  );
}

function ClientAnalyticsView({ data }: { data: ClientAnalytics }) {
  const { instagram: ig, facebook: fb, ads } = data;
  return (
    <>
      {/* Instagram */}
      <section style={card}>
        <h2 style={cardTitle}>{t('analytics.igTitle')}</h2>
        {!ig.connected ? (
          <p style={muted}>{t('analytics.igNotConnected')}</p>
        ) : ig.totals.posts === 0 ? (
          <p style={muted}>{t('analytics.igNoPosts')}</p>
        ) : (
          <>
            <div style={kpiGrid}>
              <Kpi label={t('analytics.kReach')} value={fmtNum(ig.totals.reach)} />
              <Kpi label={t('analytics.kEngagement')} value={fmtNum(ig.totals.engagement)} />
              <Kpi label={t('analytics.kViews')} value={fmtNum(ig.totals.views)} />
              <Kpi label={t('analytics.kPosts')} value={String(ig.totals.posts)} />
            </div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 12 }}>
              {ig.byKind.map((k) => (
                <div key={k.kind} style={kindCard}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>
                    {k.kind === 'video'
                      ? `🎬 ${t('analytics.kVideo')}`
                      : `🖼 ${t('analytics.kImage')}`}{' '}
                    · {k.posts}
                  </div>
                  <div style={muted}>
                    {t('analytics.kindLine', {
                      reach: fmtNum(k.reach),
                      engagement: fmtNum(k.engagement),
                    })}
                    {k.kind === 'video' ? t('analytics.kindViews', { views: fmtNum(k.views) }) : ''}
                  </div>
                </div>
              ))}
            </div>
            <MonthTable
              rows={ig.byMonth}
              cols={[
                [t('analytics.kReach'), (m) => fmtNum(m.reach)],
                [t('analytics.kEngagement'), (m) => fmtNum(m.engagement)],
                [t('analytics.kViews'), (m) => fmtNum(m.views)],
                [t('analytics.kPosts'), (m) => String(m.posts)],
              ]}
            />
          </>
        )}
      </section>

      {/* Facebook */}
      <section style={card}>
        <h2 style={cardTitle}>{t('analytics.fbTitle')}</h2>
        {!fb.connected ? (
          <p style={muted}>{t('analytics.fbNotConnected')}</p>
        ) : fb.byMonth.length === 0 ? (
          <p style={muted}>{t('analytics.fbNoMetrics')}</p>
        ) : (
          <>
            <p style={{ ...muted, margin: '0 0 8px' }}>{fb.note}</p>
            <div style={tableWrap}>
              <table style={tbl}>
                <thead>
                  <tr>
                    <th style={th}>{t('analytics.colMonth')}</th>
                    <th style={thR}>{t('analytics.colFollowers')}</th>
                    <th style={thR}>{t('analytics.kEngagement')}</th>
                    <th style={thR}>{t('analytics.kViews')}</th>
                    <th style={thR}>{t('analytics.colNew')}</th>
                    <th style={thR}>{t('analytics.kVideo')}</th>
                    <th style={thR}>{t('analytics.colReactions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {fb.byMonth.map((m) => (
                    <tr key={m.month}>
                      <td style={td}>{monthLabel(m.month)}</td>
                      <td style={tdR}>{fmtNum(m.followers)}</td>
                      <td style={tdR}>{fmtNum(m.engagement)}</td>
                      <td style={tdR}>{fmtNum(m.pageViews)}</td>
                      <td style={tdR}>{fmtNum(m.newFollows)}</td>
                      <td style={tdR}>{fmtNum(m.videoViews)}</td>
                      <td style={tdR}>{fmtNum(m.reactions)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Реклами */}
      <section style={card}>
        <h2 style={cardTitle}>{t('analytics.adsTitle')}</h2>
        {!ads.connected ? (
          <p style={muted}>{t('analytics.adsNotConnected')}</p>
        ) : ads.campaigns.length === 0 ? (
          <p style={muted}>{t('analytics.adsNoAds')}</p>
        ) : (
          <>
            <div style={kpiGrid}>
              <Kpi label={t('analytics.kSpend')} value={fmtEur(ads.totals.spend)} />
              <Kpi label={t('analytics.kReach')} value={fmtNum(ads.totals.reach)} />
              <Kpi label={t('analytics.kImpressions')} value={fmtNum(ads.totals.impressions)} />
              <Kpi label={t('analytics.kCampaigns')} value={String(ads.campaigns.length)} />
            </div>
            <MonthTable
              rows={ads.byMonth.filter((m) => m.spend > 0)}
              cols={[
                [t('analytics.kSpend'), (m) => fmtEur(m.spend)],
                [t('analytics.kReach'), (m) => fmtNum(m.reach)],
                [t('analytics.kImpressions'), (m) => fmtNum(m.impressions)],
              ]}
            />
            <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ ...treeRow, fontWeight: 600, color: 'var(--gd-ink-muted)' }}>
                <span style={{ flex: 1 }}>{t('analytics.adTree')}</span>
                <span style={treeCol}>{t('analytics.kSpend')}</span>
                <span style={treeCol}>{t('analytics.kReach')}</span>
                <span style={treeCol}>{t('analytics.colCtr')}</span>
              </div>
              {ads.campaigns.map((c) => (
                <AdTreeRow key={c.id} node={c} depth={0} />
              ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}

function AdTreeRow({ node, depth }: { node: AdNode; depth: number }) {
  const [open, setOpen] = useState(false);
  const hasChildren = !!node.children?.length;
  return (
    <>
      <div
        style={{
          ...treeRow,
          paddingLeft: 8 + depth * 18,
          cursor: hasChildren ? 'pointer' : 'default',
        }}
        onClick={() => hasChildren && setOpen((o) => !o)}
      >
        <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
          {hasChildren ? (
            open ? (
              <ChevronDown size={13} />
            ) : (
              <ChevronRight size={13} />
            )
          ) : (
            <span style={{ width: 13 }} />
          )}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontWeight: depth === 0 ? 500 : 400,
            }}
          >
            {node.name}
          </span>
        </span>
        <span style={treeCol}>{fmtEur(node.spend)}</span>
        <span style={treeCol}>{fmtNum(node.reach)}</span>
        <span style={treeCol}>{node.ctr == null ? '—' : `${node.ctr}%`}</span>
      </div>
      {open && node.children?.map((ch) => <AdTreeRow key={ch.id} node={ch} depth={depth + 1} />)}
    </>
  );
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div style={card}>
      <div style={{ fontSize: 13, color: 'var(--gd-ink-muted)' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 4 }}>
        {value}
      </div>
    </div>
  );
}

interface AnyMonthRow {
  month: string;
}
function MonthTable<T extends AnyMonthRow>({
  rows,
  cols,
}: {
  rows: T[];
  cols: Array<[string, (m: T) => string]>;
}) {
  if (rows.length <= 1) return null;
  return (
    <div style={{ ...tableWrap, marginTop: 12 }}>
      <table style={tbl}>
        <thead>
          <tr>
            <th style={th}>{t('analytics.colMonth')}</th>
            {cols.map(([h]) => (
              <th key={h} style={thR}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.month}>
              <td style={td}>{monthLabel(m.month)}</td>
              {cols.map(([h, f]) => (
                <td key={h} style={tdR}>
                  {f(m)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const muted: React.CSSProperties = { fontSize: 13, color: 'var(--gd-ink-muted)' };
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
  gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
  gap: 12,
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
  margin: '0 0 12px',
};
const kindCard: React.CSSProperties = {
  flex: '1 1 200px',
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  padding: '10px 12px',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
};
const tableWrap: React.CSSProperties = { overflowX: 'auto' };
const tbl: React.CSSProperties = {
  width: '100%',
  borderCollapse: 'collapse',
  fontSize: 13,
  fontVariantNumeric: 'tabular-nums',
};
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '6px 8px',
  borderBottom: '1px solid var(--gd-border)',
  color: 'var(--gd-ink-muted)',
  fontWeight: 500,
};
const thR: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '6px 8px', borderBottom: '1px solid var(--gd-border)' };
const tdR: React.CSSProperties = { ...td, textAlign: 'right' };
const treeRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  padding: '5px 8px',
  borderBottom: '1px solid var(--gd-border)',
  fontVariantNumeric: 'tabular-nums',
};
const treeCol: React.CSSProperties = { width: 90, textAlign: 'right', flex: '0 0 auto' };
