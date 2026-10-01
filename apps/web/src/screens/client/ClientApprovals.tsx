import { Link, useNavigate } from 'react-router-dom';
import { t } from '@gd/ui';
import { StatusBadge } from '../../components/StatusBadge.js';
import { fmtDate } from '../../lib/tasksView.js';
import { useClientApprovals, useClientLogout, type ClientApprovalItem } from '../../api/client.js';
import {
  page,
  header,
  brand,
  container,
  listCard,
  cardTitle,
  metaRow,
  muted,
  primaryBtn,
  linkBtn,
} from './clientStyles.js';

/** Листа ставки што чекаат клиентско одобрување (само `kajKlient` за сесискиот клиент). */
export function ClientApprovals() {
  const navigate = useNavigate();
  const logout = useClientLogout();
  const { data, isLoading, isError } = useClientApprovals();

  const header_ = (
    <div style={header}>
      <span style={brand}>{t('client.appTitle')}</span>
      <button
        type="button"
        style={linkBtn}
        onClick={() => logout.mutate(undefined, { onSettled: () => navigate('/client') })}
      >
        {t('client.logout')}
      </button>
    </div>
  );

  if (isError) {
    return (
      <div style={page}>
        {header_}
        <div style={container}>
          <p style={muted}>{t('client.list.sessionExpired')}</p>
          <button type="button" style={primaryBtn} onClick={() => navigate('/client')}>
            {t('client.list.requestNew')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      {header_}
      <div style={container}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: '4px 0 8px' }}>
          {t('client.list.title')}
        </h1>
        {isLoading && <p style={muted}>{t('client.list.loading')}</p>}
        {!isLoading && data?.length === 0 && <p style={muted}>{t('client.list.empty')}</p>}
        {data?.map((item: ClientApprovalItem) => (
          <Link key={item.id} to={`/client/approvals/${item.id}`} style={listCard}>
            <p style={cardTitle}>{item.title}</p>
            <div style={metaRow}>
              <StatusBadge status={item.status} />
              <span>
                {item.contentType === 'video' ? t('client.list.video') : t('client.list.graphic')}
              </span>
              <span>·</span>
              <span>{t('client.list.version', { n: item.version })}</span>
              {item.publishDate && (
                <>
                  <span>·</span>
                  <span>{t('client.list.publishDate', { date: fmtDate(item.publishDate) })}</span>
                </>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
