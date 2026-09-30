import type React from 'react';
import { Modal, t } from '@gd/ui';
import { clientReportCsvUrl, useClientReport } from '../api/reports.js';

const fmt = (n: number): string => Math.round(n).toLocaleString('mk-MK');

/** Извештај по клиент за период (H10): табела + преземи CSV. */
export function ReportModal({
  from,
  to,
  onClose,
}: {
  from: string;
  to: string;
  onClose: () => void;
}) {
  const { data, isLoading } = useClientReport(from, to);
  const rows = data?.rows ?? [];
  const label = from === to ? from : `${from} – ${to}`;

  return (
    <Modal
      open
      onClose={onClose}
      title={t('report.title', { label })}
      width={760}
      footer={
        <a href={clientReportCsvUrl(from, to)} download style={csvBtn}>
          {t('report.downloadCsv')}
        </a>
      }
    >
      {isLoading && <p style={{ color: 'var(--gd-ink-muted)' }}>{t('report.loading')}</p>}
      {!isLoading && (
        <div style={{ overflowX: 'auto' }}>
          <table style={table}>
            <thead>
              <tr>
                <th style={th}>{t('report.colClient')}</th>
                <th style={thNum}>{t('report.colVideo')}</th>
                <th style={thNum}>{t('report.colGraphic')}</th>
                <th style={thNum}>{t('report.colReach')}</th>
                <th style={thNum}>{t('report.colImpressions')}</th>
                <th style={thNum}>{t('report.colEngagement')}</th>
                <th style={thNum}>{t('report.colSpend')}</th>
                <th style={thNum}>{t('report.colCpr')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.clientId}>
                  <td style={td}>{r.name}</td>
                  <td style={tdNum}>{r.videoPosts}</td>
                  <td style={tdNum}>{r.graphicPosts}</td>
                  <td style={tdNum}>{fmt(r.reach)}</td>
                  <td style={tdNum}>{fmt(r.impressions)}</td>
                  <td style={tdNum}>{fmt(r.engagement)}</td>
                  <td style={tdNum}>{fmt(r.spend)} €</td>
                  <td style={tdNum}>{r.cpr == null ? '—' : `${r.cpr.toFixed(2)} €`}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td style={td} colSpan={8}>
                    {t('report.empty')}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}

const table: React.CSSProperties = { width: '100%', borderCollapse: 'collapse', fontSize: 13 };
const th: React.CSSProperties = {
  textAlign: 'left',
  padding: '8px 10px',
  borderBottom: '1px solid var(--gd-border)',
  color: 'var(--gd-ink-muted)',
  fontWeight: 500,
  whiteSpace: 'nowrap',
};
const thNum: React.CSSProperties = { ...th, textAlign: 'right' };
const td: React.CSSProperties = { padding: '8px 10px', borderBottom: '1px solid var(--gd-border)' };
const tdNum: React.CSSProperties = {
  ...td,
  textAlign: 'right',
  fontVariantNumeric: 'tabular-nums',
};
const csvBtn: React.CSSProperties = {
  height: 36,
  display: 'inline-flex',
  alignItems: 'center',
  padding: '0 14px',
  borderRadius: 8,
  background: 'var(--gd-primary)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 500,
  textDecoration: 'none',
};
