import type React from 'react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { t } from '@gd/ui';
import { useMe } from '../../api/auth.js';
import {
  useMetaAlerts,
  useMetaClients,
  useMetaComments,
  useMetaConversation,
  useMetaConversations,
  useMetaCross,
  useMetaOverview,
  useMetaStructure,
  usePatchAlert,
  useSetCommentTags,
  useSetConversationTags,
  useMetaPlans,
  useMetaArchive,
  useCreatePlan,
  usePlanAction,
  useMetaAssistant,
  useMetaRefresh,
  useMetaClientProfile,
  useUpdateMetaProfile,
  useMetaClientOrganic,
  useMetaConnections,
  useConversationsSummary,
  type Kpi,
  type MetaAlertRow,
  type MetaCommentRow,
  type MetaConversationRow,
  type MetaPlanRow,
  type PlanDraft,
  type PlanStatus,
  type StructureCampaign,
  type StructureAdSet,
} from '../../api/meta.js';

type MetaTab =
  'overview' | 'clients' | 'cross' | 'inbox' | 'comments' | 'plans' | 'archive' | 'connections';

// Операции O1–O12 (§12) — македонски етикети за UI.
const OP_LABELS: Record<string, string> = {
  O1: t('meta.op.O1'),
  O2: t('meta.op.O2'),
  O3: t('meta.op.O3'),
  O4: t('meta.op.O4'),
  O5: t('meta.op.O5'),
  O6: t('meta.op.O6'),
  O7: t('meta.op.O7'),
  O8: t('meta.op.O8'),
  O9: t('meta.op.O9'),
  O10: t('meta.op.O10'),
  O11: t('meta.op.O11'),
  O12: t('meta.op.O12'),
};

const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  pending: t('meta.planStatus.pending'),
  approved: t('meta.planStatus.approved'),
  syncing: t('meta.planStatus.syncing'),
  done: t('meta.planStatus.done'),
  rejected: t('meta.planStatus.rejected'),
  mismatch: t('meta.planStatus.mismatch'),
  withdrawn: t('meta.planStatus.withdrawn'),
};
const PLAN_STATUS_COLOR: Record<PlanStatus, string> = {
  pending: '#D97706',
  approved: '#0052D9',
  syncing: '#7C3AED',
  done: '#16A34A',
  rejected: '#B91C1C',
  mismatch: '#DC2626',
  withdrawn: '#6B7280',
};

const SEV_COLOR: Record<string, string> = {
  crit: '#DC2626',
  high: '#D97706',
  mid: '#7C3AED',
  info: '#0284C7',
};
const SEV_LABEL: Record<string, string> = {
  crit: t('meta.sev.crit'),
  high: t('meta.sev.high'),
  mid: t('meta.sev.mid'),
  info: t('meta.sev.info'),
};

const fmtMoney = (v: number, cur = '€') =>
  `${cur}${v.toLocaleString('mk-MK', { maximumFractionDigits: 0 })}`;
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('mk-MK') : '—');
const fmtObj = (o: Record<string, unknown> | null): string =>
  o && Object.keys(o).length
    ? Object.entries(o)
        .map(([k, v]) => `${k}: ${String(v)}`)
        .join(', ')
    : '—';

export function MetaScreen() {
  const { data: me } = useMe();
  const [params, setParams] = useSearchParams();
  const [openClient, setOpenClient] = useState<string | null>(null);
  // Заеднички контроли од топ-барот (§8): период + филтер по клиент.
  const [period, setPeriod] = useState('7');
  const [filterClientId, setFilterClientId] = useState('');

  if (!me) return null;

  // Инбокс + Коментари се достапни за сите три улоги; управувачките табови само за dir/ana (§3).
  const isManager = me.role === 'dir' || me.role === 'ana';
  // Асистентот е страничен панел (toggle), не таб (TD-11a).
  const managerTabs: MetaTab[] = [
    'overview',
    'clients',
    'cross',
    'plans',
    'archive',
    'connections',
    'inbox',
    'comments',
  ];
  const tabIds: MetaTab[] = isManager ? managerTabs : ['inbox', 'comments'];
  const tabs: Array<[MetaTab, string]> = tabIds.map((id) => [id, t(`meta.tabs.${id}`)]);

  const fallbackTab: MetaTab = isManager ? 'overview' : 'inbox';
  const requested = params.get('tab') as MetaTab | null;
  const tab: MetaTab = tabs.some(([t]) => t === requested) ? requested! : fallbackTab;

  const setTab = (t: MetaTab) => {
    const next = new URLSearchParams(params);
    next.set('tab', t);
    setParams(next);
  };

  // Асистент панел (§11) — состојба во URL за да го отвораат и топ-барот и „Прашај" од Утрински.
  const assistantOpen = isManager && params.get('assistant') === '1';
  const setAssistantOpen = (open: boolean) => {
    const next = new URLSearchParams(params);
    if (open) next.set('assistant', '1');
    else next.delete('assistant');
    setParams(next);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <header style={topBar}>
        <div style={{ display: 'flex', gap: 4 }}>
          {tabs.map(([t, label]) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t);
                setOpenClient(null);
              }}
              style={tabStyle(tab === t && !openClient)}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Заеднички контроли (§8) — само за управувачки улоги (mNotAm во прототипот). */}
      {isManager && (
        <MetaControlsBar
          period={period}
          setPeriod={setPeriod}
          filterClientId={filterClientId}
          setFilterClientId={setFilterClientId}
          assistantOpen={assistantOpen}
          onToggleAssistant={() => setAssistantOpen(!assistantOpen)}
        />
      )}

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
          {openClient ? (
            <MetaClientDetail
              clientId={openClient}
              onBack={() => setOpenClient(null)}
              period={period}
              canEdit={me.role === 'dir'}
            />
          ) : tab === 'overview' ? (
            <OverviewView clientId={filterClientId || undefined} />
          ) : tab === 'clients' ? (
            <ClientsView onOpen={setOpenClient} />
          ) : tab === 'cross' ? (
            <CrossView period={period} />
          ) : tab === 'plans' ? (
            <PlansView
              canApprove={me.role === 'dir'}
              myId={me.id}
              clientId={filterClientId || undefined}
            />
          ) : tab === 'archive' ? (
            <ArchiveView canExport={me.role === 'dir'} clientId={filterClientId || undefined} />
          ) : tab === 'connections' ? (
            <ConnectionsView />
          ) : tab === 'inbox' ? (
            <InboxView clientId={filterClientId || undefined} />
          ) : (
            <CommentsView clientId={filterClientId || undefined} />
          )}
        </div>
        {assistantOpen && (
          <AssistantPanel
            isDir={me.role === 'dir'}
            initialClientId={filterClientId || ''}
            onClose={() => setAssistantOpen(false)}
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Заеднички контроли (§8) ───────────────────────────

const PERIODS: Array<[string, string]> = [
  ['7', t('meta.topbar.period7')],
  ['30', t('meta.topbar.period30')],
  ['month', t('meta.topbar.periodMonth')],
];

function MetaControlsBar({
  period,
  setPeriod,
  filterClientId,
  setFilterClientId,
  assistantOpen,
  onToggleAssistant,
}: {
  period: string;
  setPeriod: (p: string) => void;
  filterClientId: string;
  setFilterClientId: (id: string) => void;
  assistantOpen: boolean;
  onToggleAssistant: () => void;
}) {
  const { data: clients = [] } = useMetaClients();
  const { data: ov } = useMetaOverview();
  const refresh = useMetaRefresh();
  const selected = clients.find((c) => c.id === filterClientId);
  const fresh = ov?.sync.lastSyncAt
    ? t('meta.topbar.freshness', { time: new Date(ov.sync.lastSyncAt).toLocaleString('mk-MK') })
    : t('meta.topbar.neverSynced');

  return (
    <div style={controlsBar}>
      <div
        style={{
          display: 'flex',
          border: '1px solid var(--gd-border)',
          borderRadius: 6,
          overflow: 'hidden',
        }}
      >
        {PERIODS.map(([p, label]) => (
          <button key={p} type="button" onClick={() => setPeriod(p)} style={segBtn(period === p)}>
            {label}
          </button>
        ))}
      </div>

      {selected ? (
        <span style={filterChip}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: selected.color }} />
          {selected.name}
          <button
            type="button"
            title={t('meta.topbar.allClients')}
            onClick={() => setFilterClientId('')}
            style={chipClear}
          >
            ✕
          </button>
        </span>
      ) : (
        <select
          value={filterClientId}
          onChange={(e) => setFilterClientId(e.target.value)}
          style={{ ...ghostBtn, height: 28 }}
        >
          <option value="">{t('meta.topbar.allClients')}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      )}

      <span style={{ fontSize: 12, color: 'var(--gd-ink-muted)', whiteSpace: 'nowrap' }}>
        {fresh}
      </span>
      <div style={{ flex: 1 }} />
      <button
        type="button"
        style={ghostBtn}
        disabled={refresh.isPending}
        onClick={() => refresh.mutate(filterClientId || undefined)}
      >
        {refresh.isPending ? t('meta.topbar.refreshing') : t('meta.topbar.refresh')}
      </button>
      <button
        type="button"
        style={{
          ...ghostBtn,
          borderColor: '#C7DCFF',
          background: assistantOpen ? '#0866FF' : '#fff',
          color: assistantOpen ? '#fff' : '#0052D9',
          fontWeight: 500,
        }}
        onClick={onToggleAssistant}
      >
        {t('meta.tabs.assistant')}
      </button>
    </div>
  );
}

// ─────────────────────────── Инбокс ───────────────────────────

const CHANNEL_LABEL: Record<string, string> = { messenger: 'Messenger', instagram: 'Instagram' };

function InboxView({ clientId }: { clientId?: string }) {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: convos = [], isLoading } = useMetaConversations(clientId, unreadOnly);

  return (
    <div style={{ display: 'flex', height: '100%', minHeight: 0 }}>
      <div
        style={{
          width: 340,
          borderRight: '1px solid var(--gd-border)',
          overflowY: 'auto',
          flexShrink: 0,
        }}
      >
        <div style={{ padding: 12, display: 'flex', gap: 6 }}>
          <button type="button" onClick={() => setUnreadOnly(false)} style={tabStyle(!unreadOnly)}>
            {t('meta.filters.all')}
          </button>
          <button type="button" onClick={() => setUnreadOnly(true)} style={tabStyle(unreadOnly)}>
            {t('meta.filters.unread')}
          </button>
        </div>
        {isLoading && <Loading />}
        {!isLoading && convos.length === 0 && <Empty text={t('meta.inbox.noConvos')} />}
        {convos.map((c) => (
          <ConversationListItem
            key={c.id}
            convo={c}
            active={openId === c.id}
            onOpen={() => setOpenId(c.id)}
          />
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {openId ? <ConversationDetail id={openId} /> : <Empty text={t('meta.inbox.pickConvo')} />}
      </div>
      {/* Трета колона: Резиме на пораките (§8). */}
      <InboxSummary clientId={clientId} />
    </div>
  );
}

function InboxSummary({ clientId }: { clientId?: string }) {
  const { data } = useConversationsSummary(clientId);
  return (
    <div
      style={{
        width: 280,
        borderLeft: '1px solid var(--gd-border)',
        flexShrink: 0,
        overflowY: 'auto',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <div style={{ fontSize: 14, fontWeight: 600 }}>{t('meta.inbox.summaryTitle')}</div>
      {!data ? (
        <Loading />
      ) : (
        <>
          <SideRow k={t('meta.inbox.waiting')} v={String(data.waiting)} />
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--gd-ink-secondary)',
                marginBottom: 6,
              }}
            >
              {t('meta.inbox.topics')}
            </div>
            {data.topics.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>—</div>
            )}
            {data.topics.map((tp) => (
              <SideRow key={tp.key} k={tp.key} v={String(tp.count)} />
            ))}
          </div>
          <div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: 'var(--gd-ink-secondary)',
                marginBottom: 6,
              }}
            >
              {t('meta.inbox.fromAds')}
            </div>
            {data.fromAds.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>—</div>
            )}
            {data.fromAds.map((ad) => (
              <SideRow key={ad.key} k={ad.key} v={String(ad.count)} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--gd-ink-muted)' }}>
            {t('meta.inbox.summaryNote')}
          </div>
        </>
      )}
    </div>
  );
}

function ConversationListItem({
  convo,
  active,
  onOpen,
}: {
  convo: MetaConversationRow;
  active: boolean;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
        width: '100%',
        textAlign: 'left',
        padding: '10px 12px',
        border: 'none',
        borderBottom: '1px solid var(--gd-border)',
        background: active ? '#EBF2FF' : '#fff',
        cursor: 'pointer',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {convo.unread && (
          <span
            style={{ width: 8, height: 8, borderRadius: '50%', background: '#0866FF' }}
            aria-hidden
          />
        )}
        <span style={{ fontWeight: convo.unread ? 700 : 600, fontSize: 13 }}>
          {convo.participantName ?? t('meta.shared.unknown')}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--gd-ink-muted)' }}>
          {CHANNEL_LABEL[convo.channel] ?? convo.channel}
        </span>
      </div>
      <div style={{ fontSize: 11, color: 'var(--gd-ink-muted)' }}>
        {fmtDate(convo.lastMessageAt)}
      </div>
    </button>
  );
}

function ConversationDetail({ id }: { id: string }) {
  const { data: conv } = useMetaConversation(id);
  const setTags = useSetConversationTags();
  if (!conv) return <Loading />;
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>
          {conv.participantName ?? t('meta.shared.unknown')}
        </div>
        <span style={{ ...sevPill, background: '#EBF2FF', color: '#0052D9' }}>
          {CHANNEL_LABEL[conv.channel] ?? conv.channel}
        </span>
      </div>
      <TagBar
        tags={conv.tags}
        onToggle={(tags) => setTags.mutate({ id, tags })}
        disabled={setTags.isPending}
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {conv.messages.map((m) => (
          <div
            key={m.id}
            style={{
              alignSelf: m.fromPage ? 'flex-end' : 'flex-start',
              maxWidth: '75%',
              padding: '8px 12px',
              borderRadius: 10,
              background: m.fromPage ? '#0866FF' : '#F0F2F5',
              color: m.fromPage ? '#fff' : 'var(--gd-ink)',
              fontSize: 13,
            }}
          >
            {m.bodyPurgedAt ? (
              <span style={{ fontStyle: 'italic', opacity: 0.7 }}>{t('meta.inbox.purged')}</span>
            ) : (
              (m.text ?? '—')
            )}
            <div
              style={{
                fontSize: 10,
                marginTop: 4,
                opacity: 0.7,
                color: m.fromPage ? '#fff' : 'var(--gd-ink-muted)',
              }}
            >
              {fmtDate(m.sentAt)}
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 11, color: 'var(--gd-ink-muted)', flex: 1 }}>
          {t('meta.inbox.readOnlyNote')}
        </span>
        <a
          href="https://business.facebook.com/latest/inbox"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...ghostBtn, textDecoration: 'none' }}
        >
          {t('meta.common.openInMeta')}
        </a>
      </div>
    </div>
  );
}

// ─────────────────────────── Коментари ───────────────────────────

const COMMENT_FILTERS: Array<[string, string]> = [
  ['', t('meta.filters.all')],
  ['open', t('meta.filters.commentsOpen')],
  ['q', t('meta.filters.commentsQuestions')],
  ['ads', t('meta.filters.commentsAds')],
  ['bad', t('meta.filters.commentsBad')],
];

function CommentsView({ clientId }: { clientId?: string }) {
  const [filter, setFilter] = useState('');
  const { data: comments = [], isLoading } = useMetaComments(clientId, filter || undefined);
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {COMMENT_FILTERS.map(([f, label]) => (
          <button key={f} type="button" onClick={() => setFilter(f)} style={tabStyle(filter === f)}>
            {label}
          </button>
        ))}
      </div>
      {isLoading && <Loading />}
      {!isLoading && comments.length === 0 && <Empty text={t('meta.comments.empty')} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {comments.map((c) => (
          <CommentRow key={c.id} comment={c} />
        ))}
      </div>
      {comments.length > 0 && (
        <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>
          {t('meta.comments.footer')}
        </div>
      )}
    </div>
  );
}

function CommentRow({ comment }: { comment: MetaCommentRow }) {
  const setTags = useSetCommentTags();
  return (
    <div style={{ ...rowCard, alignItems: 'flex-start', cursor: 'default' }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {comment.authorName ?? t('meta.shared.unknown')}
          </span>
          {comment.parentObjectType === 'ad' && (
            <span style={{ ...sevPill, background: '#EBF2FF', color: '#0052D9' }}>
              {t('meta.comments.badgeAd')}
            </span>
          )}
          {comment.isQuestion && (
            <span style={{ ...sevPill, background: '#E0F2FE', color: '#0369A1' }}>
              {t('meta.comments.badgeQuestion')}
            </span>
          )}
          {comment.isComplaint && (
            <span style={{ ...sevPill, background: '#FEF2F2', color: '#B91C1C' }}>
              {t('meta.comments.badgeComplaint')}
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gd-ink-muted)' }}>
            {fmtDate(comment.createdTime)}
          </span>
        </div>
        <div style={{ fontSize: 13, marginTop: 4 }}>{comment.text ?? '—'}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <TagBar
            tags={comment.tags}
            onToggle={(tags) => setTags.mutate({ id: comment.id, tags })}
            disabled={setTags.isPending}
          />
          <a
            href="https://business.facebook.com/latest/content_calendar"
            target="_blank"
            rel="noopener noreferrer"
            style={{ fontSize: 11, color: '#0052D9', textDecoration: 'none', marginTop: 6 }}
          >
            {t('meta.common.openInMeta')} ›
          </a>
        </div>
      </div>
    </div>
  );
}

// Внатрешни ознаки (обработка) — не се праќаат во Meta.
const TAG_OPTIONS: Array<[string, string]> = [
  ['done', t('meta.tags.done')],
  ['forClient', t('meta.tags.forClient')],
  ['important', t('meta.tags.important')],
];

function TagBar({
  tags,
  onToggle,
  disabled,
}: {
  tags: string[];
  onToggle: (tags: string[]) => void;
  disabled: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
      {TAG_OPTIONS.map(([key, label]) => {
        const on = tags.includes(key);
        return (
          <button
            key={key}
            type="button"
            disabled={disabled}
            onClick={() => onToggle(on ? tags.filter((x) => x !== key) : [...tags, key])}
            style={{
              ...sevPill,
              cursor: disabled ? 'default' : 'pointer',
              border: 'none',
              background: on ? '#0866FF' : '#F0F2F5',
              color: on ? '#fff' : 'var(--gd-ink-secondary)',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

const ALERT_FILTERS: Array<[string, string]> = [
  ['', t('meta.filters.all')],
  ['crit', t('meta.filters.alertsCrit')],
  ['high', t('meta.filters.alertsHigh')],
  ['mid', t('meta.filters.alertsMid')],
];

function OverviewView({ clientId }: { clientId?: string }) {
  const { data: ov } = useMetaOverview();
  const { data: alerts = [] } = useMetaAlerts(clientId);
  const patch = usePatchAlert();
  const [sev, setSev] = useState('');
  const [, setParams] = useSearchParams();
  if (!ov) return <Loading />;

  const shown = sev ? alerts.filter((a) => a.severity === sev) : alerts;
  const seenAll = () =>
    alerts
      .filter((a) => a.state !== 'seen')
      .forEach((a) => patch.mutate({ id: a.id, state: 'seen' }));

  return (
    <div
      style={{
        padding: 20,
        display: 'grid',
        gridTemplateColumns: 'minmax(0,2fr) minmax(280px,1fr)',
        gap: 16,
        alignItems: 'start',
      }}
    >
      {/* Лево: „Што бара внимание" */}
      <div style={{ background: '#fff', border: '1px solid var(--gd-border)', borderRadius: 8 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '12px 16px',
            borderBottom: '1px solid var(--gd-border)',
            flexWrap: 'wrap',
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600, flex: 1, minWidth: 140 }}>
            {t('meta.overview.attention')}
          </span>
          {ALERT_FILTERS.map(([s, label]) => (
            <button
              key={s}
              type="button"
              onClick={() => setSev(s)}
              style={{
                ...sevPill,
                cursor: 'pointer',
                border: '1px solid var(--gd-border)',
                background: sev === s ? '#0866FF' : '#fff',
                color: sev === s ? '#fff' : 'var(--gd-ink)',
              }}
            >
              {label}
            </button>
          ))}
          <button type="button" style={ghostBtn} onClick={seenAll} disabled={patch.isPending}>
            {t('meta.overview.seenAll')}
          </button>
        </div>
        {shown.length === 0 && <Empty text={t('meta.overview.empty')} />}
        {shown.map((a) => (
          <AlertRow key={a.id} alert={a} onPatch={(state) => patch.mutate({ id: a.id, state })} />
        ))}
      </div>

      {/* Десно: sidebar */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={sideCard}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{t('meta.overview.syncTitle')}</div>
          <SideRow
            k={t('meta.overview.syncLast')}
            v={ov.sync.lastSyncAt ? new Date(ov.sync.lastSyncAt).toLocaleString('mk-MK') : '—'}
          />
          <SideRow k={t('meta.overview.syncAccounts')} v={String(ov.sync.accounts)} />
          <SideRow k={t('meta.overview.syncFailing')} v={String(ov.sync.failing)} />
        </div>
        <div style={sideCard}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{t('meta.overview.accessTitle')}</div>
          <SideRow
            k={t('meta.overview.accessManage')}
            v={`${ov.sync.accounts - ov.sync.readOnly} ${t('meta.overview.accounts')}`}
          />
          <SideRow
            k={t('meta.overview.accessRead')}
            v={`${ov.sync.readOnly} ${t('meta.overview.accounts')}`}
          />
          <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>
            {t('meta.overview.accessNote')}
          </div>
        </div>
        <div style={sideCard}>
          <div style={{ fontSize: 14, fontWeight: 600 }}>{t('meta.overview.askTitle')}</div>
          <div style={{ fontSize: 13, color: 'var(--gd-ink-secondary)' }}>
            {t('meta.overview.askExample')}
          </div>
          <button
            type="button"
            style={{ ...ghostBtn, alignSelf: 'flex-start' }}
            onClick={() =>
              setParams((p) => {
                const n = new URLSearchParams(p);
                n.set('assistant', '1');
                return n;
              })
            }
          >
            {t('meta.overview.ask')}
          </button>
        </div>
      </div>
    </div>
  );
}

function SideRow({ k, v }: { k: string; v: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
      <span style={{ color: 'var(--gd-ink-muted)' }}>{k}</span>
      <span>{v}</span>
    </div>
  );
}

function AlertRow({ alert, onPatch }: { alert: MetaAlertRow; onPatch: (state: string) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '12px 16px',
        borderBottom: '1px solid var(--gd-border)',
      }}
    >
      <span
        style={{
          flex: '0 0 auto',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 5,
          height: 22,
          padding: '0 8px',
          borderRadius: 4,
          fontSize: 11,
          fontWeight: 600,
          background: `${SEV_COLOR[alert.severity]}1A`,
          color: SEV_COLOR[alert.severity],
        }}
      >
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: '50%',
            background: SEV_COLOR[alert.severity],
          }}
        />
        {SEV_LABEL[alert.severity]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: alert.state === 'new' ? 600 : 500, fontSize: 14 }}>
          {alert.title}
        </div>
        {alert.detail && (
          <div style={{ color: 'var(--gd-ink-secondary)', fontSize: 13, marginTop: 2 }}>
            {alert.detail}
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)', marginTop: 2 }}>
          {alert.code}
          {alert.occurrences > 1 ? ` · ${t('plural.day', { count: alert.occurrences })}` : ''}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
        {alert.state === 'snoozed' ? (
          <button type="button" style={ghostBtn} onClick={() => onPatch('new')}>
            {t('meta.overview.unsnooze')}
          </button>
        ) : (
          <button type="button" style={ghostBtn} onClick={() => onPatch('snoozed')}>
            {t('meta.overview.snooze')}
          </button>
        )}
        {alert.state !== 'seen' && (
          <button
            type="button"
            style={{ ...ghostBtn, borderColor: '#C7DCFF', color: '#0052D9' }}
            onClick={() => onPatch('seen')}
          >
            {t('meta.overview.seen')}
          </button>
        )}
      </div>
    </div>
  );
}

const CLIENT_COLS = '1.5fr 1.6fr .8fr .9fr .6fr .8fr .6fr 1.3fr';

function ClientsView({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: clients = [] } = useMetaClients();
  if (clients.length === 0) return <Empty text={t('meta.clients.empty')} />;
  return (
    <div style={{ padding: 20 }}>
      <div
        style={{
          border: '1px solid var(--gd-border)',
          borderRadius: 8,
          overflow: 'auto',
          background: '#fff',
        }}
      >
        <div style={{ minWidth: 980 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: CLIENT_COLS,
              gap: 12,
              padding: '10px 16px',
              background: '#F7F8FA',
              borderBottom: '1px solid var(--gd-border)',
              fontSize: 12,
              fontWeight: 500,
              color: 'var(--gd-ink-muted)',
            }}
          >
            <span>{t('meta.clients.colClient')}</span>
            <span>{t('meta.clients.colGoal')}</span>
            <span>{t('meta.clients.colToday')}</span>
            <span>{t('meta.clients.colMonth')}</span>
            <span>{t('meta.clients.colCampaigns')}</span>
            <span>{t('meta.clients.colAlerts')}</span>
            <span>{t('meta.clients.colMessages')}</span>
            <span>{t('meta.clients.colLast')}</span>
          </div>
          {clients.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpen(c.id)}
              style={{
                display: 'grid',
                gridTemplateColumns: CLIENT_COLS,
                gap: 12,
                width: '100%',
                padding: '12px 16px',
                border: 'none',
                borderBottom: '1px solid var(--gd-border)',
                background: '#fff',
                textAlign: 'left',
                alignItems: 'center',
                fontSize: 14,
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
                  {c.name}
                </span>
                <span style={{ fontSize: 12, color: 'var(--gd-ink-muted)', marginLeft: 16 }}>
                  {c.accessLevel === 'read' ? t('meta.shared.readOnly') : t('meta.shared.manage')}
                </span>
              </span>
              <span style={{ fontSize: 13, color: 'var(--gd-ink-secondary)' }}>
                {c.target ?? '—'}
              </span>
              <span>{fmtMoney(c.todaySpend, c.currency === 'USD' ? '$' : '€')}</span>
              <span>{fmtMoney(c.monthSpend, c.currency === 'USD' ? '$' : '€')}</span>
              <span>{c.campaigns}</span>
              <span
                style={{ fontWeight: 500, color: c.alerts > 0 ? '#B91C1C' : 'var(--gd-ink-muted)' }}
              >
                {c.alerts || '—'}
              </span>
              <span>{c.messages || '—'}</span>
              <span style={{ fontSize: 13, color: 'var(--gd-ink-muted)' }}>
                {fmtDate(c.lastSyncAt)}
              </span>
            </button>
          ))}
        </div>
      </div>
      <div style={{ fontSize: 13, color: 'var(--gd-ink-muted)', marginTop: 12 }}>
        {t('meta.clients.footer')}
      </div>
    </div>
  );
}

const CROSS_COLS = '1.8fr 1.3fr .9fr 1.1fr 1fr .7fr 1.2fr';

function CrossView({ period }: { period: string }) {
  const { data } = useMetaCross(period);
  if (!data) return <Loading />;
  const hasData = data.groups.length > 0;
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* KPI */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))',
          gap: 12,
        }}
      >
        <Card title={t('meta.cross.kpiSpend')} value={fmtMoney(data.kpis.spend)} />
        <Card title={t('meta.cross.kpiCampaigns')} value={String(data.kpis.campaigns)} />
      </div>

      {!hasData && <Empty text={t('meta.cross.empty')} />}
      {hasData && (
        <div
          style={{
            background: '#fff',
            border: '1px solid var(--gd-border)',
            borderRadius: 8,
            overflow: 'auto',
          }}
        >
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--gd-border)' }}>
            <div style={{ fontSize: 16, fontWeight: 600 }}>{t('meta.cross.title')}</div>
            <div style={{ fontSize: 13, color: 'var(--gd-ink-muted)' }}>
              {t('meta.cross.subtitle')}
            </div>
          </div>
          <div style={{ minWidth: 960 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: CROSS_COLS,
                gap: 12,
                padding: '10px 16px',
                background: '#F7F8FA',
                borderBottom: '1px solid var(--gd-border)',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--gd-ink-muted)',
              }}
            >
              <span>{t('meta.cross.colCampaign')}</span>
              <span>{t('meta.cross.colObjective')}</span>
              <span>{t('meta.cross.colSpend')}</span>
              <span>{t('meta.cross.colResults')}</span>
              <span>{t('meta.cross.colCpr')}</span>
              <span>{t('meta.cross.colChange')}</span>
              <span>{t('meta.cross.colGoal')}</span>
            </div>
            {data.groups.flatMap((g) =>
              g.items.map((it) => (
                <div
                  key={it.campaignMetaId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: CROSS_COLS,
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--gd-border)',
                    fontSize: 14,
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontWeight: 500, minWidth: 0 }}>{it.name}</span>
                  <span style={{ fontSize: 13, color: 'var(--gd-ink-muted)' }}>
                    {g.objectiveLabel}
                  </span>
                  <span>{fmtMoney(it.spend)}</span>
                  <span>{it.results.toLocaleString('mk-MK')}</span>
                  <span>{it.cpr != null ? fmtMoney(it.cpr) : '—'}</span>
                  <span
                    style={{
                      fontWeight: 600,
                      color:
                        it.cprChangePct == null
                          ? 'var(--gd-ink-muted)'
                          : it.cprChangePct > 0
                            ? '#B91C1C'
                            : '#15803D',
                    }}
                  >
                    {it.cprChangePct == null
                      ? '—'
                      : `${it.cprChangePct > 0 ? '↑' : '↓'} ${Math.abs(it.cprChangePct)}%`}
                  </span>
                  <span style={{ fontSize: 13, color: 'var(--gd-ink-muted)' }}>
                    {it.goal ?? '—'}
                  </span>
                </div>
              )),
            )}
          </div>
        </div>
      )}
      {hasData && (
        <div style={{ fontSize: 13, color: 'var(--gd-ink-muted)' }}>{t('meta.cross.footer')}</div>
      )}
    </div>
  );
}

// ─────────────────────────── Мета · Клиент (детал со табови, MF2) ───────────────────────────

type ClientTab = 'ads' | 'organic' | 'profile';

function MetaClientDetail({
  clientId,
  onBack,
  period,
  canEdit,
}: {
  clientId: string;
  onBack: () => void;
  period: string;
  canEdit: boolean;
}) {
  const [ctab, setCtab] = useState<ClientTab>('ads');
  const { data: prof } = useMetaClientProfile(clientId);
  const readOnly = prof?.accessLevel === 'read';

  const cTabs: Array<[ClientTab, string]> = [
    ['ads', t('meta.client.tabAds')],
    ['organic', t('meta.client.tabOrganic')],
    ['profile', t('meta.client.tabProfile')],
  ];

  return (
    <div style={{ padding: 20 }}>
      <button type="button" onClick={onBack} style={{ ...ghostBtn, marginBottom: 12 }}>
        {t('meta.client.back')}
      </button>

      {/* Заглавие */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: prof?.color ?? '#C4CBD4',
          }}
        />
        <span style={{ fontSize: 20, fontWeight: 600 }}>{prof?.name ?? '…'}</span>
        {prof?.accessLevel && (
          <span
            style={{
              ...sevPill,
              background: readOnly ? '#FEF3C7' : '#EBF2FF',
              color: readOnly ? '#B45309' : '#0052D9',
            }}
          >
            {readOnly ? t('meta.shared.readOnly') : t('meta.shared.manage')}
          </span>
        )}
      </div>
      <div style={{ fontSize: 13, color: 'var(--gd-ink-muted)', marginBottom: 12 }}>
        {[prof?.adAccountId, prof?.currency].filter(Boolean).join(' · ') || '—'}
      </div>

      {/* Табови на клиентот */}
      <div
        style={{
          display: 'flex',
          gap: 20,
          borderBottom: '1px solid var(--gd-border)',
          marginBottom: 16,
        }}
      >
        {cTabs.map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setCtab(id)}
            style={{
              height: 38,
              border: 'none',
              background: 'transparent',
              padding: '0 2px',
              fontSize: 14,
              fontWeight: 500,
              color: ctab === id ? '#0866FF' : 'var(--gd-ink)',
              borderBottom: `2px solid ${ctab === id ? '#0866FF' : 'transparent'}`,
              cursor: 'pointer',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {ctab === 'ads' && (
        <>
          {readOnly && (
            <div
              style={{
                fontSize: 12,
                color: '#B45309',
                background: '#FEF3C7',
                border: '1px solid #FDE68A',
                borderRadius: 8,
                padding: '10px 12px',
                marginBottom: 12,
              }}
            >
              {t('meta.client.readonly')}
            </div>
          )}
          <StructureView clientId={clientId} period={period} canPropose={!readOnly} />
        </>
      )}
      {ctab === 'organic' && <OrganicTab clientId={clientId} period={period} />}
      {ctab === 'profile' && <ProfileTab clientId={clientId} canEdit={canEdit} />}
    </div>
  );
}

function OrganicTab({ clientId, period }: { clientId: string; period: string }) {
  const { data } = useMetaClientOrganic(clientId, period);
  if (!data) return <Loading />;
  if (!data.connected) return <Empty text={t('meta.client.orgNotConnected')} />;
  if (data.totals.posts === 0) return <Empty text={t('meta.client.orgEmpty')} />;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Card title={t('meta.client.orgPosts')} value={String(data.totals.posts)} />
        <Card title={t('meta.client.orgReach')} value={data.totals.reach.toLocaleString('mk-MK')} />
        <Card title={t('meta.client.orgViews')} value={data.totals.views.toLocaleString('mk-MK')} />
        <Card
          title={t('meta.client.orgEngagement')}
          value={data.totals.engagement.toLocaleString('mk-MK')}
        />
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill,minmax(220px,1fr))',
          gap: 12,
        }}
      >
        {data.posts.map((p) => (
          <div
            key={p.id}
            style={{ border: '1px solid var(--gd-border)', borderRadius: 8, padding: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>
                {p.mediaType === 'video' ? t('meta.client.orgVideo') : t('meta.client.orgImage')}
              </span>
              {p.inAd && (
                <span style={{ ...sevPill, background: '#EBF2FF', color: '#0052D9' }}>
                  {t('meta.client.inAd')}
                </span>
              )}
              <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--gd-ink-muted)' }}>
                {fmtDate(p.publishedAt)}
              </span>
            </div>
            <div style={{ fontSize: 12, marginBottom: 6, maxHeight: 40, overflow: 'hidden' }}>
              {p.caption ?? '—'}
            </div>
            <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>
              {t('meta.client.orgPostStats', {
                reach: (p.reach ?? 0).toLocaleString('mk-MK'),
                views: (p.views ?? 0).toLocaleString('mk-MK'),
                engagement: (p.engagement ?? 0).toLocaleString('mk-MK'),
              })}
            </div>
            {p.permalink && (
              <a
                href={p.permalink}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...ghostBtn,
                  textDecoration: 'none',
                  display: 'inline-block',
                  marginTop: 8,
                }}
              >
                {t('meta.common.openInMeta')}
              </a>
            )}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>{t('meta.client.orgFooter')}</div>
    </div>
  );
}

function ProfileTab({ clientId, canEdit }: { clientId: string; canEdit: boolean }) {
  const { data } = useMetaClientProfile(clientId);
  const update = useUpdateMetaProfile(clientId);
  const [form, setForm] = useState<Record<string, string>>({});
  if (!data) return <Loading />;
  const p = data.profile;
  const val = (k: string, fallback: string | number | null) =>
    form[k] !== undefined ? form[k] : fallback == null ? '' : String(fallback);
  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const save = () => {
    update.mutate({
      targetText: val('targetText', p.targetText) || null,
      maxDailyBudget: val('maxBudget', p.maxDailyBudget)
        ? Number(val('maxBudget', p.maxDailyBudget))
        : null,
      freqThreshold: Number(val('freq', p.freqThreshold)),
      cprAlertPct: Number(val('cpr', p.cprAlertPct)),
      namingConvention: val('naming', p.namingConvention) || null,
      notes: val('notes', p.notes) || null,
    });
  };

  const fields: Array<[string, string, string | number | null]> = [
    ['targetText', t('meta.client.fTarget'), p.targetText],
    ['maxBudget', t('meta.client.fMaxBudget'), p.maxDailyBudget],
    ['freq', t('meta.client.fFreq'), p.freqThreshold],
    ['cpr', t('meta.client.fCpr'), p.cprAlertPct],
    ['naming', t('meta.client.fNaming'), p.namingConvention],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 520 }}>
      <div style={{ border: '1px solid var(--gd-border)', borderRadius: 8, padding: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>
          {t('meta.client.goals')}
        </div>
        {fields.map(([k, label, cur]) => (
          <div key={k} style={{ marginBottom: 10 }}>
            <label style={modalLabel}>{label}</label>
            <input
              style={modalInput}
              disabled={!canEdit}
              value={val(k, cur)}
              onChange={(e) => set(k, e.target.value)}
            />
          </div>
        ))}
      </div>
      <div style={{ border: '1px solid var(--gd-border)', borderRadius: 8, padding: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>
          {t('meta.client.notes')}
        </div>
        <textarea
          style={{ ...modalInput, minHeight: 80, resize: 'vertical' }}
          disabled={!canEdit}
          value={val('notes', p.notes)}
          onChange={(e) => set('notes', e.target.value)}
        />
        <div style={{ fontSize: 11, color: 'var(--gd-ink-muted)', marginTop: 6 }}>
          {t('meta.client.notesHint')}
        </div>
      </div>
      {canEdit && (
        <button
          type="button"
          disabled={update.isPending}
          style={{
            ...ghostBtn,
            background: '#0866FF',
            color: '#fff',
            border: 'none',
            alignSelf: 'flex-start',
          }}
          onClick={save}
        >
          {t('meta.client.save')}
        </button>
      )}
    </div>
  );
}

function StructureView({
  clientId,
  period,
  canPropose = false,
}: {
  clientId: string;
  period: string;
  canPropose?: boolean;
}) {
  const { data } = useMetaStructure(clientId, period);
  const [openSet, setOpenSet] = useState<string | null>(null);
  const [planInit, setPlanInit] = useState<PlanModalInit | null>(null);

  if (!data) return <Loading />;
  if (data.campaigns.length === 0) return <Empty text={t('meta.client.noCampaigns')} />;

  // Најди го избраниот ad set + неговата кампања.
  let selCampaign: StructureCampaign | undefined;
  let selSet: StructureAdSet | undefined;
  for (const c of data.campaigns) {
    const s = c.adSets.find((x) => x.metaId === openSet);
    if (s) {
      selCampaign = c;
      selSet = s;
      break;
    }
  }

  return (
    <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
      {/* Лево: структура (кампањи → ad set-ови избирливи) */}
      <div
        style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 12 }}
      >
        {canPropose && (
          <button
            type="button"
            style={{
              ...ghostBtn,
              alignSelf: 'flex-start',
              borderColor: '#C7DCFF',
              color: '#0052D9',
            }}
            onClick={() => setPlanInit({ clientId, op: 'O8' })}
          >
            {t('meta.client.newCampaign')}
          </button>
        )}
        {data.campaigns.map((c) => (
          <div
            key={c.metaId}
            style={{ border: '1px solid var(--gd-border)', borderRadius: 8, padding: 12 }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 14 }}>{c.name}</span>
              <StatusDot status={c.effectiveStatus} />
              <span style={{ color: 'var(--gd-ink-muted)', fontSize: 12 }}>{c.objectiveLabel}</span>
              <span style={{ marginLeft: 'auto', fontSize: 12 }}>
                <KpiInline kpi={c.kpi} resultLabel={c.resultLabel} />
              </span>
            </div>
            {canPropose && (
              <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                <button
                  type="button"
                  style={miniBtn}
                  onClick={() => setPlanInit({ clientId, op: 'O2', campaignId: c.metaId })}
                >
                  {t('meta.client.actBudget')}
                </button>
                <button
                  type="button"
                  style={miniBtn}
                  onClick={() => setPlanInit({ clientId, op: 'O1', campaignId: c.metaId })}
                >
                  {t('meta.client.actPause')}
                </button>
              </div>
            )}
            {c.adSets.map((s) => (
              <button
                key={s.metaId}
                type="button"
                onClick={() => setOpenSet(s.metaId)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  width: '100%',
                  textAlign: 'left',
                  marginTop: 8,
                  padding: '6px 8px',
                  border: 'none',
                  borderLeft: `2px solid ${openSet === s.metaId ? '#0866FF' : '#E2E7EB'}`,
                  background: openSet === s.metaId ? '#EBF2FF' : 'transparent',
                  cursor: 'pointer',
                }}
              >
                <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                <StatusDot status={s.effectiveStatus} />
                {s.learningStage === 'LIMITED' && (
                  <span style={{ ...sevPill, background: '#FEF3C7', color: '#B45309' }}>
                    {t('meta.client.adLearning')}
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gd-ink-muted)' }}>
                  <KpiInline kpi={s.kpi} resultLabel={c.resultLabel} />
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>

      {/* Десно: детал на избран ad set */}
      <div style={{ flex: '1 1 0', minWidth: 0, position: 'sticky', top: 0 }}>
        {selSet && selCampaign ? (
          <div style={{ border: '1px solid var(--gd-border)', borderRadius: 8, padding: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 15 }}>{selSet.name}</span>
              <StatusDot status={selSet.effectiveStatus} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)', marginTop: 2 }}>
              {selCampaign.name} · {selCampaign.objectiveLabel}
            </div>
            {/* KPI грид */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))',
                gap: 8,
                marginTop: 12,
              }}
            >
              <Card title={t('meta.client.kpiSpend')} value={fmtMoney(selSet.kpi.spend)} />
              <Card
                title={selCampaign.resultLabel}
                value={selSet.kpi.results.toLocaleString('mk-MK')}
              />
              <Card
                title={t('meta.client.kpiReach')}
                value={selSet.kpi.reach.toLocaleString('mk-MK')}
              />
              <Card
                title={t('meta.client.kpiCpr')}
                value={selSet.kpi.cpr != null ? fmtMoney(selSet.kpi.cpr) : '—'}
              />
            </div>
            {canPropose && (
              <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
                <button
                  type="button"
                  style={miniBtn}
                  onClick={() =>
                    setPlanInit({ clientId, op: 'O1', campaignId: selCampaign!.metaId })
                  }
                >
                  {t('meta.client.actPause')}
                </button>
              </div>
            )}
            {/* Реклами */}
            <div style={{ fontSize: 13, fontWeight: 600, marginTop: 16, marginBottom: 6 }}>
              {t('meta.client.adsInSet')}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {selSet.ads.map((ad) => (
                <div
                  key={ad.metaId}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    padding: '6px 0',
                    borderBottom: '1px solid var(--gd-border)',
                  }}
                >
                  <StatusDot status={ad.effectiveStatus} />
                  <span style={{ flex: 1, minWidth: 0 }}>{ad.name}</span>
                  {ad.reviewStatus === 'rejected' && (
                    <span style={{ ...sevPill, background: '#FEF2F2', color: '#B91C1C' }}>
                      {t('meta.client.adRejected')}
                    </span>
                  )}
                  <span style={{ color: 'var(--gd-ink-muted)' }}>
                    <KpiInline kpi={ad.kpi} resultLabel={selCampaign!.resultLabel} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <Empty text={t('meta.client.selectAdSet')} />
        )}
      </div>

      {planInit && <CreatePlanModal init={planInit} onClose={() => setPlanInit(null)} />}
    </div>
  );
}

function KpiInline({ kpi, resultLabel }: { kpi: Kpi; resultLabel: string }) {
  return (
    <>
      {fmtMoney(kpi.spend)} · {kpi.results.toLocaleString('mk-MK')} {resultLabel.toLowerCase()}
      {kpi.cpr != null ? ` · ${fmtMoney(kpi.cpr)}${t('meta.client.cprSuffix')}` : ''}
    </>
  );
}

function StatusDot({ status }: { status: string | null }) {
  const active = status === 'ACTIVE';
  return (
    <span
      title={status ?? ''}
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: active ? '#16A34A' : '#C4CBD4',
      }}
    />
  );
}

function Card({ title, value, sub }: { title: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        border: '1px solid var(--gd-border)',
        borderRadius: 8,
        padding: '12px 16px',
        minWidth: 160,
      }}
    >
      <div style={{ fontSize: 11, color: 'var(--gd-ink-muted)', textTransform: 'uppercase' }}>
        {title}
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, marginTop: 4 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--gd-ink-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function Loading() {
  return (
    <div style={{ padding: 40, color: 'var(--gd-ink-muted)' }}>{t('meta.shared.loading')}</div>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div style={{ padding: 24, color: 'var(--gd-ink-muted)', textAlign: 'center' }}>{text}</div>
  );
}

// ─────────────────────────── Планови (§12) ───────────────────────────

const PLAN_FILTERS: Array<[string, string]> = [
  ['', t('meta.filters.all')],
  ['pending', t('meta.filters.plansPending')],
  ['approved', t('meta.filters.plansApproved')],
  ['syncing', t('meta.filters.plansSyncing')],
  ['mismatch', t('meta.filters.plansMismatch')],
];

function PlansView({
  canApprove,
  myId,
  clientId,
}: {
  canApprove: boolean;
  myId: string;
  clientId?: string;
}) {
  const [status, setStatus] = useState('');
  const [creating, setCreating] = useState(false);
  const { data: plans = [], isLoading } = useMetaPlans(clientId, status || undefined);
  const action = usePlanAction();

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {PLAN_FILTERS.map(([s, label]) => (
          <button key={s} type="button" onClick={() => setStatus(s)} style={tabStyle(status === s)}>
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setCreating(true)}
          style={{ ...tabStyle(false), marginLeft: 'auto', background: '#0866FF', color: '#fff' }}
        >
          {t('meta.plans.newPlan')}
        </button>
      </div>

      {isLoading && <Loading />}
      {!isLoading && plans.length === 0 && <Empty text={t('meta.plans.empty')} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {plans.map((p) => (
          <PlanRow
            key={p.id}
            plan={p}
            canApprove={canApprove}
            isOwner={p.createdById === myId}
            onAction={(a, note) => action.mutate({ id: p.id, action: a, note })}
            pending={action.isPending}
          />
        ))}
      </div>

      {creating && <CreatePlanModal onClose={() => setCreating(false)} />}
    </div>
  );
}

function PlanRow({
  plan,
  canApprove,
  isOwner,
  onAction,
  pending,
}: {
  plan: MetaPlanRow;
  canApprove: boolean;
  isOwner: boolean;
  onAction: (action: 'approve' | 'reject' | 'mark-done' | 'withdraw', note?: string) => void;
  pending: boolean;
}) {
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const before = plan.before as Record<string, unknown> | null;
  const after = plan.after as Record<string, unknown> | null;
  const fmtVal = (v: Record<string, unknown> | null): string =>
    v && Object.keys(v).length
      ? Object.entries(v)
          .map(([k, val]) => `${k}: ${String(val)}`)
          .join(', ')
      : '—';
  const target = plan.target?.campaignId ?? plan.target?.adSetId ?? plan.target?.adId ?? null;

  return (
    <div
      style={{
        border: '1px solid var(--gd-border)',
        borderLeft: `3px solid ${PLAN_STATUS_COLOR[plan.status]}`,
        borderRadius: 8,
        background: '#fff',
        padding: 14,
        display: 'flex',
        gap: 12,
        alignItems: 'flex-start',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 11, color: 'var(--gd-ink-muted)' }}>P-{plan.id.slice(0, 8)}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          {plan.clientColor && (
            <span
              style={{ width: 8, height: 8, borderRadius: '50%', background: plan.clientColor }}
            />
          )}
          <span style={{ fontWeight: 600, fontSize: 13 }}>
            {plan.clientName ? `${plan.clientName} · ` : ''}
            {OP_LABELS[plan.op] ?? plan.op}
            <span style={{ color: 'var(--gd-ink-muted)', fontWeight: 400, marginLeft: 6 }}>
              {plan.op}
            </span>
          </span>
          <span
            style={{
              ...sevPill,
              background: `${PLAN_STATUS_COLOR[plan.status]}1A`,
              color: PLAN_STATUS_COLOR[plan.status],
            }}
          >
            {PLAN_STATUS_LABEL[plan.status]}
          </span>
        </div>
        {target && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--gd-ink-muted)',
              marginTop: 4,
              fontFamily: 'monospace',
            }}
          >
            {t('meta.plans.target')}: {target}
          </div>
        )}

        {/* Пред → После */}
        {(before || after) && (
          <div style={{ display: 'flex', alignItems: 'stretch', gap: 8, marginTop: 8 }}>
            <div style={{ flex: 1, background: '#F7F8FA', borderRadius: 6, padding: '6px 10px' }}>
              <div style={{ fontSize: 10, color: 'var(--gd-ink-muted)' }}>
                {t('meta.plans.before')}
              </div>
              <div style={{ fontSize: 12 }}>{fmtVal(before)}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', color: 'var(--gd-ink-muted)' }}>
              →
            </div>
            <div style={{ flex: 1, background: '#EBF2FF', borderRadius: 6, padding: '6px 10px' }}>
              <div style={{ fontSize: 10, color: '#0052D9' }}>{t('meta.plans.after')}</div>
              <div style={{ fontSize: 12 }}>{fmtVal(after)}</div>
            </div>
          </div>
        )}

        {plan.warnings.length > 0 && (
          <div style={{ fontSize: 12, marginTop: 6, color: '#B45309' }}>
            ⚠ {plan.warnings.join(' · ')}
          </div>
        )}
        {plan.consequences.length > 0 && (
          <div style={{ fontSize: 12, marginTop: 4, color: 'var(--gd-ink-secondary)' }}>
            {plan.consequences.join(' · ')}
          </div>
        )}
        {plan.command && (
          <div
            style={{
              fontSize: 12,
              marginTop: 4,
              color: 'var(--gd-ink-muted)',
              fontStyle: 'italic',
            }}
          >
            {t('meta.plans.command')}: „{plan.command}"
          </div>
        )}
        {plan.rejectNote && (
          <div style={{ fontSize: 12, marginTop: 4, color: '#B91C1C' }}>
            {t('meta.plans.rejected')}: {plan.rejectNote}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--gd-ink-muted)', marginTop: 6 }}>
          {[plan.authorName, fmtDate(plan.createdAt)].filter(Boolean).join(' · ')}
        </div>

        {/* Inline reject форма (замена за window.prompt) */}
        {rejectOpen && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <textarea
              style={{ ...modalInput, minHeight: 60, resize: 'vertical' }}
              placeholder={t('meta.plans.rejectReason')}
              value={rejectNote}
              onChange={(e) => setRejectNote(e.target.value)}
            />
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button type="button" style={ghostBtn} onClick={() => setRejectOpen(false)}>
                {t('meta.plans.rejectCancel')}
              </button>
              <button
                type="button"
                disabled={pending || !rejectNote.trim()}
                style={{ ...ghostBtn, background: '#B91C1C', color: '#fff', border: 'none' }}
                onClick={() => {
                  onAction('reject', rejectNote);
                  setRejectOpen(false);
                }}
              >
                {t('meta.plans.rejectConfirm')}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {canApprove && plan.status === 'pending' && !rejectOpen && (
          <>
            <button
              type="button"
              disabled={pending}
              style={{ ...ghostBtn, background: '#0866FF', color: '#fff', border: 'none' }}
              onClick={() => onAction('approve')}
            >
              {t('meta.plans.approve')}
            </button>
            <button
              type="button"
              disabled={pending}
              style={{ ...ghostBtn, borderColor: '#FCA5A5', color: '#B91C1C' }}
              onClick={() => setRejectOpen(true)}
            >
              {t('meta.plans.reject')}
            </button>
          </>
        )}
        {canApprove && (plan.status === 'approved' || plan.status === 'syncing') && (
          <a
            href="https://business.facebook.com/adsmanager"
            target="_blank"
            rel="noopener noreferrer"
            style={{ ...ghostBtn, textDecoration: 'none', textAlign: 'center' }}
          >
            {t('meta.common.openInAds')}
          </a>
        )}
        {canApprove && plan.status === 'approved' && (
          <button
            type="button"
            disabled={pending}
            style={{ ...ghostBtn, background: '#0866FF', color: '#fff', border: 'none' }}
            onClick={() => onAction('mark-done')}
          >
            {t('meta.plans.doneInAds')}
          </button>
        )}
        {isOwner && plan.status === 'pending' && (
          <button
            type="button"
            disabled={pending}
            style={ghostBtn}
            onClick={() => onAction('withdraw')}
          >
            {t('meta.plans.withdraw')}
          </button>
        )}
      </div>
    </div>
  );
}

interface PlanModalInit {
  clientId?: string;
  op?: string;
  campaignId?: string;
}

function CreatePlanModal({
  onClose,
  draft,
  init,
}: {
  onClose: () => void;
  draft?: PlanDraft;
  init?: PlanModalInit;
}) {
  const { data: clients = [] } = useMetaClients();
  const create = useCreatePlan();
  const [clientId, setClientId] = useState(draft?.clientId ?? init?.clientId ?? '');
  const [op, setOp] = useState(draft?.op ?? init?.op ?? 'O2');
  const [campaignId, setCampaignId] = useState(draft?.target.campaignId ?? init?.campaignId ?? '');
  const [amount, setAmount] = useState(
    draft?.params.amount != null ? String(draft.params.amount) : '',
  );
  const [name, setName] = useState(draft?.params.name != null ? String(draft.params.name) : '');
  const [note, setNote] = useState('');

  const submit = () => {
    if (!clientId) return;
    const params: Record<string, unknown> = {};
    if (op === 'O2') params.amount = Number(amount);
    if (op === 'O11') params.name = name;
    if (op === 'O1') params.status = (draft?.params.status as string) ?? 'PAUSED';
    create.mutate(
      {
        op,
        clientId,
        target: campaignId ? { campaignId } : {},
        params,
        note: note || undefined,
        via: draft ? 'assistant' : 'manual',
        command: draft?.command,
      },
      { onSuccess: onClose },
    );
  };

  return (
    <div style={modalBackdrop} onClick={onClose}>
      <div style={modalCard} onClick={(e) => e.stopPropagation()}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>
          {t('meta.createPlan.title')}
        </div>
        <label style={modalLabel}>{t('meta.createPlan.client')}</label>
        <select style={modalInput} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">{t('meta.createPlan.pick')}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label style={modalLabel}>{t('meta.createPlan.op')}</label>
        <select style={modalInput} value={op} onChange={(e) => setOp(e.target.value)}>
          {Object.entries(OP_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {code} · {label}
            </option>
          ))}
        </select>
        <label style={modalLabel}>{t('meta.createPlan.campaign')}</label>
        <input
          style={modalInput}
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
        />
        {op === 'O2' && (
          <>
            <label style={modalLabel}>{t('meta.createPlan.newBudget')}</label>
            <input
              style={modalInput}
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </>
        )}
        {op === 'O11' && (
          <>
            <label style={modalLabel}>{t('meta.createPlan.newName')}</label>
            <input style={modalInput} value={name} onChange={(e) => setName(e.target.value)} />
          </>
        )}
        <label style={modalLabel}>{t('meta.createPlan.note')}</label>
        <input style={modalInput} value={note} onChange={(e) => setNote(e.target.value)} />
        <div style={{ fontSize: 11, color: 'var(--gd-ink-muted)', margin: '8px 0' }}>
          {t('meta.createPlan.hint')}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" style={ghostBtn} onClick={onClose}>
            {t('meta.createPlan.cancel')}
          </button>
          <button
            type="button"
            disabled={!clientId || create.isPending}
            style={{ ...ghostBtn, background: '#0866FF', color: '#fff', border: 'none' }}
            onClick={submit}
          >
            {t('meta.createPlan.create')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Архива (§4.7) ───────────────────────────

const ARCHIVE_COLS = '150px 1.2fr 1fr 1.4fr .9fr 2fr';

function ArchiveView({ canExport, clientId }: { canExport: boolean; clientId?: string }) {
  const { data: rows = [], isLoading } = useMetaArchive(clientId);
  const csvHref = clientId ? `/api/meta/archive.csv?clientId=${clientId}` : '/api/meta/archive.csv';
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--gd-ink-muted)', flex: 1 }}>
          {t('meta.archive.note')}
        </span>
        {canExport && (
          <a href={csvHref} style={{ ...ghostBtn, textDecoration: 'none' }}>
            {t('meta.archive.exportCsv')}
          </a>
        )}
      </div>
      {isLoading && <Loading />}
      {!isLoading && rows.length === 0 && <Empty text={t('meta.archive.empty')} />}
      {rows.length > 0 && (
        <div
          style={{
            border: '1px solid var(--gd-border)',
            borderRadius: 8,
            overflow: 'auto',
            background: '#fff',
          }}
        >
          <div style={{ minWidth: 900 }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: ARCHIVE_COLS,
                gap: 12,
                padding: '10px 16px',
                background: '#F7F8FA',
                borderBottom: '1px solid var(--gd-border)',
                fontSize: 12,
                fontWeight: 500,
                color: 'var(--gd-ink-muted)',
              }}
            >
              <span>{t('meta.archive.colWhen')}</span>
              <span>{t('meta.archive.colClient')}</span>
              <span>{t('meta.archive.colObject')}</span>
              <span>{t('meta.archive.colEvent')}</span>
              <span>{t('meta.archive.colWho')}</span>
              <span>{t('meta.archive.colNarrative')}</span>
            </div>
            {rows.map((r) => (
              <div
                key={r.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: ARCHIVE_COLS,
                  gap: 12,
                  padding: '10px 16px',
                  borderBottom: '1px solid var(--gd-border)',
                  fontSize: 13,
                  alignItems: 'center',
                }}
              >
                <span style={{ fontSize: 11, color: 'var(--gd-ink-muted)' }}>
                  {fmtDate(r.occurredAt)}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  {r.clientColor && (
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: r.clientColor,
                        flexShrink: 0,
                      }}
                    />
                  )}
                  {r.clientName ?? '—'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>{r.objectType}</span>
                <span style={{ fontSize: 12, fontFamily: 'monospace' }}>{r.eventType}</span>
                <span style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>
                  {r.actorRole ?? t('meta.archive.systemActor')}
                </span>
                <span>{r.narrative}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────── AI помошник (§11) ───────────────────────────

interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  draft?: PlanDraft | null;
}

function AssistantPanel({
  isDir,
  initialClientId,
  onClose,
}: {
  isDir: boolean;
  initialClientId: string;
  onClose: () => void;
}) {
  const { data: clients = [] } = useMetaClients();
  const [clientId, setClientId] = useState(initialClientId);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [draftToOpen, setDraftToOpen] = useState<PlanDraft | null>(null);
  const chat = useMetaAssistant();

  const send = () => {
    const text = input.trim();
    if (!text || chat.isPending) return;
    setMessages((m) => [...m, { role: 'user', text }]);
    setInput('');
    chat.mutate(
      { message: text, clientId: clientId || undefined },
      {
        onSuccess: (res) =>
          setMessages((m) => [...m, { role: 'assistant', text: res.answer, draft: res.draft }]),
        onError: () =>
          setMessages((m) => [...m, { role: 'assistant', text: t('meta.assistant.error') }]),
      },
    );
  };

  const suggestions = [
    t('meta.assistant.suggest1'),
    t('meta.assistant.suggest2'),
    t('meta.assistant.suggest3'),
  ];
  const ask = (text: string) => {
    setMessages((m) => [...m, { role: 'user', text }]);
    chat.mutate(
      { message: text, clientId: clientId || undefined },
      {
        onSuccess: (res) =>
          setMessages((m) => [...m, { role: 'assistant', text: res.answer, draft: res.draft }]),
      },
    );
  };

  return (
    <div
      style={{
        width: 380,
        flexShrink: 0,
        borderLeft: '1px solid var(--gd-border)',
        background: '#fff',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        minHeight: 0,
      }}
    >
      <div
        style={{
          padding: 12,
          borderBottom: '1px solid var(--gd-border)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 14, fontWeight: 600, color: '#0052D9', flex: 1 }}>
          {t('meta.assistant.header')}
        </span>
        <button type="button" style={chipClear} title={t('meta.assistant.close')} onClick={onClose}>
          ✕
        </button>
      </div>
      <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--gd-border)' }}>
        <select
          style={{ ...modalInput, width: '100%' }}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          <option value="">{t('meta.assistant.allClientsForPlan')}</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {messages.length === 0 && (
          <div style={{ color: 'var(--gd-ink-muted)', fontSize: 13 }}>
            {t('meta.assistant.intro')}
          </div>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '80%',
              padding: '10px 14px',
              borderRadius: 10,
              whiteSpace: 'pre-wrap',
              fontSize: 13,
              background: m.role === 'user' ? '#0866FF' : '#F0F2F5',
              color: m.role === 'user' ? '#fff' : 'var(--gd-ink)',
            }}
          >
            {m.text}
            {m.draft && (
              <div
                style={{
                  marginTop: 8,
                  background: '#fff',
                  border: '1px solid var(--gd-border)',
                  borderRadius: 8,
                  padding: 10,
                  color: 'var(--gd-ink)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>
                  {OP_LABELS[m.draft.op] ?? m.draft.op}
                </div>
                {(m.draft.before || m.draft.after) && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span
                      style={{
                        flex: 1,
                        background: '#F7F8FA',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 11,
                      }}
                    >
                      {fmtObj(m.draft.before)}
                    </span>
                    <span style={{ color: 'var(--gd-ink-muted)' }}>→</span>
                    <span
                      style={{
                        flex: 1,
                        background: '#EBF2FF',
                        borderRadius: 6,
                        padding: '4px 8px',
                        fontSize: 11,
                      }}
                    >
                      {fmtObj(m.draft.after)}
                    </span>
                  </div>
                )}
                {m.draft.warnings.length > 0 && (
                  <div style={{ fontSize: 11, color: '#B45309', marginBottom: 6 }}>
                    ⚠ {m.draft.warnings.join(' · ')}
                  </div>
                )}
                <button
                  type="button"
                  style={{ ...ghostBtn, background: '#0866FF', color: '#fff', border: 'none' }}
                  onClick={() => setDraftToOpen(m.draft!)}
                >
                  {isDir ? t('meta.assistant.openAsPlan') : t('meta.assistant.sendForApproval')}
                </button>
              </div>
            )}
          </div>
        ))}
        {chat.isPending && (
          <div style={{ color: 'var(--gd-ink-muted)', fontSize: 12 }}>
            {t('meta.assistant.typing')}
          </div>
        )}
      </div>

      {/* Предлог-прашања (§11) */}
      <div style={{ display: 'flex', gap: 6, padding: '0 12px', flexWrap: 'wrap' }}>
        {suggestions.map((s) => (
          <button
            key={s}
            type="button"
            disabled={chat.isPending}
            onClick={() => ask(s)}
            style={{ ...ghostBtn, borderColor: '#C7DCFF', color: '#0052D9', borderRadius: 9999 }}
          >
            {s}
          </button>
        ))}
      </div>

      <div
        style={{ display: 'flex', gap: 8, padding: 12, borderTop: '1px solid var(--gd-border)' }}
      >
        <input
          style={{ ...modalInput, flex: 1 }}
          placeholder={t('meta.assistant.placeholder')}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
        />
        <button
          type="button"
          style={{ ...ghostBtn, background: '#0866FF', color: '#fff', border: 'none' }}
          onClick={send}
          disabled={chat.isPending}
        >
          {t('meta.assistant.send')}
        </button>
      </div>

      {draftToOpen && <CreatePlanModal draft={draftToOpen} onClose={() => setDraftToOpen(null)} />}
    </div>
  );
}

// ─────────────────────────── Поврзувања (§8, MF3) ───────────────────────────

function ConnectionsView() {
  const { data } = useMetaConnections();
  if (!data) return <Loading />;
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Токен-картички (без вредности, §12) */}
      <div>
        <div style={sectionTitle}>{t('meta.connections.tokensTitle')}</div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
            gap: 12,
          }}
        >
          {data.tokens.map((tok) => {
            const status = !tok.configured
              ? t('meta.connections.missing')
              : tok.valid
                ? t('meta.connections.configured')
                : t('meta.connections.invalid');
            const color = !tok.configured ? '#8A93A0' : tok.valid ? '#15803D' : '#B91C1C';
            return (
              <div
                key={tok.name}
                style={{ border: '1px solid var(--gd-border)', borderRadius: 8, padding: 14 }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{tok.name}</span>
                  <span style={{ marginLeft: 'auto', fontSize: 12, color }}>{status}</span>
                </div>
                {tok.expiresAt && (
                  <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)', marginTop: 4 }}>
                    {t('meta.connections.expires', { date: fmtDate(tok.expiresAt) })}
                  </div>
                )}
                {tok.scopes.length > 0 && (
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--gd-ink-muted)',
                      marginTop: 6,
                      fontFamily: 'monospace',
                      wordBreak: 'break-word',
                    }}
                  >
                    {tok.scopes.join(', ')}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)', marginTop: 8 }}>
          {t('meta.connections.tokensNote')}
        </div>
      </div>

      {/* Табела конекции */}
      {data.rows.length === 0 ? (
        <Empty text={t('meta.connections.empty')} />
      ) : (
        <div style={{ border: '1px solid var(--gd-border)', borderRadius: 8, overflow: 'auto' }}>
          <div style={{ minWidth: 860 }}>
            <div style={connHeadRow}>
              <span>{t('meta.connections.colClient')}</span>
              <span>{t('meta.connections.colAccount')}</span>
              <span>{t('meta.connections.colCurrency')}</span>
              <span>{t('meta.connections.colAccess')}</span>
              <span>{t('meta.connections.colPage')}</span>
              <span>{t('meta.connections.colIg')}</span>
              <span>{t('meta.connections.colIgMsg')}</span>
            </div>
            {data.rows.map((r) => (
              <div key={r.clientId} style={connRow}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
                  {r.name}
                </span>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.adAccount ?? '—'}</span>
                <span>{r.currency ?? '—'}</span>
                <span>{r.accessLevel ?? '—'}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.page ?? '—'}</span>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.ig ?? '—'}</span>
                <span style={{ color: r.igMessages ? '#15803D' : 'var(--gd-ink-muted)' }}>
                  {r.igMessages == null
                    ? '—'
                    : r.igMessages
                      ? t('meta.shared.yes')
                      : t('meta.shared.no')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

const topBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  padding: '10px 16px',
  borderBottom: '1px solid var(--gd-border)',
  gap: 8,
};
const tabStyle = (active: boolean): React.CSSProperties => ({
  padding: '6px 12px',
  borderRadius: 6,
  border: 'none',
  background: active ? '#0866FF' : 'transparent',
  color: active ? '#fff' : 'var(--gd-ink)',
  fontWeight: active ? 600 : 500,
  fontSize: 13,
  cursor: 'pointer',
});
const sectionTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--gd-ink-secondary)',
  marginBottom: 8,
  display: 'flex',
  alignItems: 'center',
};
const rowCard: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: 12,
  borderRadius: 8,
  border: '1px solid var(--gd-border)',
  background: '#fff',
  width: '100%',
  cursor: 'pointer',
};
const sevPill: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 999,
};
const ghostBtn: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 6,
  border: '1px solid var(--gd-border)',
  background: '#fff',
  fontSize: 12,
  cursor: 'pointer',
};
const miniBtn: React.CSSProperties = {
  padding: '4px 8px',
  borderRadius: 6,
  border: '1px solid #C7DCFF',
  background: '#fff',
  color: '#0052D9',
  fontSize: 11,
  cursor: 'pointer',
};
const sideCard: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  padding: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
};
const connHeadRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.4fr 1.4fr .7fr 1fr 1fr 1fr .7fr',
  gap: 12,
  padding: '10px 16px',
  background: '#F7F8FA',
  borderBottom: '1px solid var(--gd-border)',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--gd-ink-muted)',
};
const connRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1.4fr 1.4fr .7fr 1fr 1fr 1fr .7fr',
  gap: 12,
  padding: '12px 16px',
  borderBottom: '1px solid var(--gd-border)',
  fontSize: 13,
  alignItems: 'center',
};
const controlsBar: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '8px 16px',
  borderBottom: '1px solid var(--gd-border)',
  background: '#fff',
};
const segBtn = (active: boolean): React.CSSProperties => ({
  height: 28,
  padding: '0 10px',
  border: 'none',
  fontSize: 13,
  fontWeight: 500,
  background: active ? '#0866FF' : '#fff',
  color: active ? '#fff' : 'var(--gd-ink)',
  cursor: 'pointer',
});
const filterChip: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  height: 28,
  padding: '0 4px 0 10px',
  border: '1px solid #C7DCFF',
  borderRadius: 9999,
  background: '#EBF2FF',
  color: '#0052D9',
  fontSize: 13,
  fontWeight: 500,
  whiteSpace: 'nowrap',
};
const chipClear: React.CSSProperties = {
  width: 22,
  height: 22,
  border: 'none',
  borderRadius: '50%',
  background: 'transparent',
  color: '#0052D9',
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
};
const modalBackdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
};
const modalCard: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 24,
  width: 420,
  maxWidth: '90vw',
  maxHeight: '90vh',
  overflowY: 'auto',
  boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
};
const modalLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--gd-ink-secondary)',
  marginBottom: 4,
  marginTop: 10,
};
const modalInput: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid var(--gd-border)',
  fontSize: 13,
  boxSizing: 'border-box',
};
