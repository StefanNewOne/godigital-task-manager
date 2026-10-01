import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { t } from '@gd/ui';
import { ApiRequestError } from '../../lib/api.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { fmtDate } from '../../lib/tasksView.js';
import { useClientApproval, useClientDecide } from '../../api/client.js';
import {
  page,
  header,
  brand,
  container,
  cardTitle,
  metaRow,
  muted,
  textarea,
  actionsRow,
  primaryBtn,
  secondaryBtn,
  errStyleInline,
  toastBox,
} from './clientStyles.js';

/** Детал на ставка + клиентска одлука: Одобри (напред) или Побарај измени (назад, бара коментар). */
export function ClientApprovalDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data, isLoading, isError } = useClientApproval(id);
  const decide = useClientDecide(id);

  const [mode, setMode] = useState<null | 'requestChanges'>(null);
  const [comment, setComment] = useState('');
  const [commentErr, setCommentErr] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const header_ = (
    <div style={header}>
      <span style={brand}>{t('client.appTitle')}</span>
      <button type="button" style={secondaryBtn} onClick={() => navigate('/client/approvals')}>
        {t('client.detail.back')}
      </button>
    </div>
  );

  function finish(msg: string) {
    setToast(msg);
    window.setTimeout(() => navigate('/client/approvals', { replace: true }), 1200);
  }

  function approve() {
    decide.mutate({ outcome: 'approve' }, { onSuccess: () => finish(t('client.detail.approved')) });
  }

  function submitChanges() {
    if (!comment.trim()) {
      setCommentErr(true);
      return;
    }
    decide.mutate(
      { outcome: 'requestChanges', comment: comment.trim() },
      { onSuccess: () => finish(t('client.detail.returned')) },
    );
  }

  if (isError) {
    return (
      <div style={page}>
        {header_}
        <div style={container}>
          <p style={muted}>{t('client.detail.notFound')}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={page}>
      {header_}
      <div style={container}>
        {isLoading && <p style={muted}>{t('client.list.loading')}</p>}
        {data && (
          <>
            <h1 style={cardTitle}>{data.title}</h1>
            <div style={metaRow}>
              <StatusBadge status={data.status} />
              <span>
                {data.contentType === 'video' ? t('client.list.video') : t('client.list.graphic')}
              </span>
              <span>·</span>
              <span>{t('client.list.version', { n: data.version })}</span>
              {data.publishDate && (
                <>
                  <span>·</span>
                  <span>{t('client.list.publishDate', { date: fmtDate(data.publishDate) })}</span>
                </>
              )}
            </div>

            {mode === 'requestChanges' && (
              <label style={{ display: 'block', marginTop: 16 }}>
                <span style={{ ...muted, display: 'block', marginBottom: 6 }}>
                  {t('client.detail.commentLabel')}
                </span>
                <textarea
                  style={textarea}
                  value={comment}
                  onChange={(e) => {
                    setComment(e.target.value);
                    if (commentErr) setCommentErr(false);
                  }}
                />
                {commentErr && (
                  <span style={errStyleInline}>{t('client.detail.commentRequired')}</span>
                )}
              </label>
            )}

            {decide.isError && (
              <p style={errStyleInline}>
                {decide.error instanceof ApiRequestError
                  ? decide.error.message
                  : t('client.detail.error')}
              </p>
            )}

            <div style={actionsRow}>
              {mode === 'requestChanges' ? (
                <button
                  type="button"
                  style={primaryBtn}
                  disabled={decide.isPending}
                  onClick={submitChanges}
                >
                  {decide.isPending ? t('client.detail.submitting') : t('client.detail.submit')}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    style={secondaryBtn}
                    disabled={decide.isPending}
                    onClick={() => setMode('requestChanges')}
                  >
                    {t('client.detail.requestChanges')}
                  </button>
                  <button
                    type="button"
                    style={primaryBtn}
                    disabled={decide.isPending}
                    onClick={approve}
                  >
                    {t('client.detail.approve')}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
      {toast && <div style={toastBox}>{toast}</div>}
    </div>
  );
}
