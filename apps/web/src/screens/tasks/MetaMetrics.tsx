import type React from 'react';
import { t } from '@gd/ui';
import { useTaskMeta } from '../../api/tasks.js';

/**
 * Модул 3 · Мета (§9.1) — живи метрики во таскот: органика + платено + планови.
 * Го заменува статичниот блок во зоната Аналитика. Изворот е еден (истите бројки како во Мета).
 */
export function MetaMetrics({ taskId, show }: { taskId: string; show: boolean }) {
  const { data, isLoading } = useTaskMeta(taskId, show);
  if (!show) return null;
  if (isLoading) return <div style={muted}>{t('metaMetrics.loading')}</div>;
  if (!data) return null;

  if (!data.publication) {
    return <div style={muted}>{t('metaMetrics.notLinked')}</div>;
  }
  const p = data.publication;
  const cur = data.paid[0]?.currency ?? '€';
  const money = (v: number) => `${cur}${v.toLocaleString('mk-MK', { maximumFractionDigits: 0 })}`;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: '#8A93A0' }}>
        {t('metaMetrics.metaLine', {
          state:
            p.resolveStatus === 'resolved'
              ? t('metaMetrics.metaConnected')
              : t('metaMetrics.metaPending'),
          platform: p.platform.toUpperCase(),
        })}
      </div>

      {/* Органика */}
      {data.organic && (
        <div>
          <div style={label}>{t('metaMetrics.organic')}</div>
          <div style={metricRow}>
            <Metric k={t('metaMetrics.views')} v={data.organic.views.toLocaleString('mk-MK')} />
            {!data.fbPerPostUnavailable && data.organic.reach != null && (
              <Metric k={t('metaMetrics.reach')} v={data.organic.reach.toLocaleString('mk-MK')} />
            )}
            <Metric
              k={t('metaMetrics.engagement')}
              v={data.organic.engagement.toLocaleString('mk-MK')}
            />
          </div>
          {data.fbPerPostUnavailable && <div style={muted}>{t('metaMetrics.fbNoPerPost')}</div>}
        </div>
      )}

      {/* Платено */}
      {data.paid.length > 0 && (
        <div>
          <div style={label}>
            {t('metaMetrics.paid')}{' '}
            {!data.freshness.paidIsFinal && (
              <span style={muted}>{t('metaMetrics.paidNotFinal')}</span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {data.paid.map((ad) => (
              <div key={ad.adId} style={paidCard}>
                <div style={{ fontWeight: 600, fontSize: 13 }}>{ad.adName}</div>
                <div style={muted}>
                  {ad.campaignName} · {ad.adSetName}
                </div>
                <div style={{ ...metricRow, marginTop: 4 }}>
                  <Metric k={t('metaMetrics.spend')} v={money(ad.spend)} />
                  <Metric k={t('metaMetrics.results')} v={ad.results.toLocaleString('mk-MK')} />
                  {ad.cpr != null && <Metric k={t('metaMetrics.cpr')} v={money(ad.cpr)} />}
                  {ad.reviewStatus === 'rejected' && (
                    <span style={{ ...pill, background: '#FEF2F2', color: '#B91C1C' }}>
                      {t('metaMetrics.adRejected')}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Планови */}
      {data.plans.length > 0 && (
        <div>
          <div style={label}>{t('metaMetrics.changePlans')}</div>
          {data.plans.map((pl) => (
            <div key={pl.id} style={muted}>
              {pl.op} · {pl.status}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#8A93A0' }}>{k}</div>
      <div style={{ fontSize: 15, fontWeight: 600 }}>{v}</div>
    </div>
  );
}

const muted: React.CSSProperties = { fontSize: 12, color: '#8A93A0' };
const label: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: '#5C6672',
  marginBottom: 6,
};
const metricRow: React.CSSProperties = {
  display: 'flex',
  gap: 20,
  alignItems: 'flex-end',
  flexWrap: 'wrap',
};
const paidCard: React.CSSProperties = {
  border: '1px solid #E2E7EB',
  borderRadius: 8,
  padding: 10,
};
const pill: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 999,
};
