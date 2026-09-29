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
  type Kpi,
  type MetaAlertRow,
  type MetaCommentRow,
  type MetaConversationRow,
  type MetaPlanRow,
  type PlanDraft,
  type PlanStatus,
} from '../../api/meta.js';

type MetaTab =
  'overview' | 'clients' | 'cross' | 'inbox' | 'comments' | 'plans' | 'archive' | 'assistant';

// Операции O1–O12 (§12) — македонски етикети за UI.
const OP_LABELS: Record<string, string> = {
  O1: 'Пауза / активирај',
  O2: 'Дневен буџет',
  O3: 'Закажан буџет',
  O4: 'Реклама од пост',
  O5: 'Ново видео',
  O6: 'Копирај ad set',
  O7: 'Нов ad set',
  O8: 'Нова кампања',
  O9: 'Распоред (краен датум)',
  O10: 'CTA / линк / шаблон',
  O11: 'Преименување',
  O12: 'Дуплирај кампања',
};

const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  pending: 'На чекање',
  approved: 'Одобрен',
  syncing: 'Се проверува',
  done: 'Завршен',
  rejected: 'Одбиен',
  mismatch: 'Несовпаѓање',
  withdrawn: 'Повлечен',
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
  crit: 'Критично',
  high: 'Високо',
  mid: 'Средно',
  info: 'Инфо',
};

const fmtMoney = (v: number, cur = '€') =>
  `${cur}${v.toLocaleString('mk-MK', { maximumFractionDigits: 0 })}`;
const fmtDate = (iso: string | null) => (iso ? new Date(iso).toLocaleString('mk-MK') : '—');

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
  const managerTabs: MetaTab[] = [
    'overview',
    'clients',
    'cross',
    'plans',
    'archive',
    'assistant',
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
        />
      )}

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {openClient ? (
          <StructureView clientId={openClient} onBack={() => setOpenClient(null)} period={period} />
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
        ) : tab === 'assistant' ? (
          <AssistantView isDir={me.role === 'dir'} />
        ) : tab === 'inbox' ? (
          <InboxView clientId={filterClientId || undefined} />
        ) : (
          <CommentsView clientId={filterClientId || undefined} />
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
}: {
  period: string;
  setPeriod: (p: string) => void;
  filterClientId: string;
  setFilterClientId: (id: string) => void;
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
            Сите
          </button>
          <button type="button" onClick={() => setUnreadOnly(true)} style={tabStyle(unreadOnly)}>
            Непрочитани
          </button>
        </div>
        {isLoading && <Loading />}
        {!isLoading && convos.length === 0 && <Empty text="Нема разговори." />}
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
        {openId ? <ConversationDetail id={openId} /> : <Empty text="Избери разговор." />}
      </div>
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
          {convo.participantName ?? 'непознат'}
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
        <div style={{ fontWeight: 700, fontSize: 15 }}>{conv.participantName ?? 'непознат'}</div>
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
              <span style={{ fontStyle: 'italic', opacity: 0.7 }}>
                текстот е избришан (12 месеци)
              </span>
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
          Само читање — одговарај директно во Meta Business Suite.
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
  ['', 'Сите'],
  ['open', 'Необработени'],
  ['q', 'Прашања'],
  ['ads', 'Од реклами'],
  ['bad', 'Поплаки'],
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
      {!isLoading && comments.length === 0 && <Empty text="Нема коментари." />}
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
          <span style={{ fontWeight: 600, fontSize: 13 }}>{comment.authorName ?? 'непознат'}</span>
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
        <TagBar
          tags={comment.tags}
          onToggle={(tags) => setTags.mutate({ id: comment.id, tags })}
          disabled={setTags.isPending}
        />
      </div>
    </div>
  );
}

// Внатрешни ознаки (обработка) — не се праќаат во Meta.
const TAG_OPTIONS: Array<[string, string]> = [
  ['done', 'обработено'],
  ['forClient', 'за клиентот'],
  ['important', 'важно'],
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
            onClick={() => onToggle(on ? tags.filter((t) => t !== key) : [...tags, key])}
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

function OverviewView({ clientId }: { clientId?: string }) {
  const { data: ov } = useMetaOverview();
  const { data: alerts = [] } = useMetaAlerts(clientId);
  const patch = usePatchAlert();
  if (!ov) return <Loading />;

  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* KPI картички */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <Card title="Отворени алерти" value={String(ov.alerts.total)} />
        <Card title="Активни кампањи" value={String(ov.kpi.activeCampaigns)} />
        <Card title="Потрошено денес" value={fmtMoney(ov.kpi.todaySpend)} />
        <Card
          title="Последен sync"
          value={
            ov.sync.lastSyncAt ? new Date(ov.sync.lastSyncAt).toLocaleTimeString('mk-MK') : '—'
          }
          sub={`${ov.sync.accounts} акаунти · ${ov.sync.readOnly} read-only`}
        />
      </div>

      {/* Алерти по сериозност */}
      <div style={{ display: 'flex', gap: 8 }}>
        {(['crit', 'high', 'mid', 'info'] as const).map((s) => (
          <span
            key={s}
            style={{ ...sevPill, background: `${SEV_COLOR[s]}1A`, color: SEV_COLOR[s] }}
          >
            {SEV_LABEL[s]}: {ov.alerts[s]}
          </span>
        ))}
      </div>

      {/* Листа алерти */}
      <div>
        <div style={sectionTitle}>Алерти</div>
        {alerts.length === 0 && <Empty text="Нема отворени алерти." />}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map((a) => (
            <AlertRow key={a.id} alert={a} onPatch={(state) => patch.mutate({ id: a.id, state })} />
          ))}
        </div>
      </div>
    </div>
  );
}

function AlertRow({ alert, onPatch }: { alert: MetaAlertRow; onPatch: (state: string) => void }) {
  return (
    <div style={{ ...rowCard, borderLeft: `3px solid ${SEV_COLOR[alert.severity]}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 13 }}>
          {alert.title}
          <span style={{ color: 'var(--gd-ink-muted)', fontWeight: 400, marginLeft: 8 }}>
            {alert.code}
            {alert.occurrences > 1 ? ` · ${alert.occurrences} дена` : ''}
          </span>
        </div>
        <div style={{ color: 'var(--gd-ink-secondary)', fontSize: 12, marginTop: 2 }}>
          {alert.detail}
        </div>
      </div>
      {alert.state !== 'seen' && (
        <button type="button" style={ghostBtn} onClick={() => onPatch('seen')}>
          Видено
        </button>
      )}
      <button type="button" style={ghostBtn} onClick={() => onPatch('snoozed')}>
        Одложи
      </button>
    </div>
  );
}

function ClientsView({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: clients = [] } = useMetaClients();
  if (clients.length === 0) return <Empty text="Нема клиенти со Meta реклами." />;
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
      {clients.map((c) => (
        <button key={c.id} type="button" onClick={() => onOpen(c.id)} style={rowCard}>
          <span
            style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }}
            aria-hidden
          />
          <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
            <div style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</div>
            <div style={{ color: 'var(--gd-ink-muted)', fontSize: 12 }}>
              {c.target ?? 'без цел'} · {c.campaigns} кампањи · {c.currency ?? '—'}
              {c.accessLevel === 'read' ? ' · само читање' : ''}
            </div>
          </div>
          {c.alerts > 0 && (
            <span style={{ ...sevPill, background: '#FEF2F2', color: '#B91C1C' }}>
              {c.alerts} алерти
            </span>
          )}
          <span style={{ color: 'var(--gd-ink-muted)', fontSize: 11 }}>
            {fmtDate(c.lastSyncAt)}
          </span>
        </button>
      ))}
      <div style={{ fontSize: 13, color: 'var(--gd-ink-muted)', marginTop: 4 }}>
        {t('meta.clients.footer')}
      </div>
    </div>
  );
}

function CrossView({ period }: { period: string }) {
  const { data } = useMetaCross(period);
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      {!data && <Loading />}
      {data?.groups.length === 0 && <Empty text="Нема податоци за периодот." />}
      {data?.groups.map((g) => (
        <div key={g.objectiveKey}>
          <div style={sectionTitle}>
            {g.objectiveLabel}
            {g.aggregatable && (
              <span style={{ ...sevPill, background: '#EBF2FF', color: '#0052D9', marginLeft: 8 }}>
                Збир: {fmtMoney(g.spend)} · {g.results.toLocaleString('mk-MK')} рез.
              </span>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {g.items.map((it) => (
              <div key={it.campaignMetaId} style={rowCard}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 13 }}>{it.name}</div>
                  <div style={{ color: 'var(--gd-ink-muted)', fontSize: 12 }}>
                    {fmtMoney(it.spend)} · {it.results.toLocaleString('mk-MK')} {it.resultLabel} ·{' '}
                    {it.cpr != null ? `${it.costLabel}: ${fmtMoney(it.cpr)}` : 'без резултати'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
      {data && data.groups.length > 0 && (
        <div style={{ fontSize: 13, color: 'var(--gd-ink-muted)' }}>{t('meta.cross.footer')}</div>
      )}
    </div>
  );
}

function StructureView({
  clientId,
  onBack,
  period,
}: {
  clientId: string;
  onBack: () => void;
  period: string;
}) {
  const { data } = useMetaStructure(clientId, period);
  return (
    <div style={{ padding: 20 }}>
      <button type="button" onClick={onBack} style={{ ...ghostBtn, marginBottom: 12 }}>
        ← Назад на клиенти
      </button>
      {!data && <Loading />}
      {data?.campaigns.length === 0 && <Empty text="Нема кампањи." />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {data?.campaigns.map((c) => (
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
            {c.adSets.map((s) => (
              <div
                key={s.metaId}
                style={{ marginTop: 8, paddingLeft: 12, borderLeft: '2px solid #E2E7EB' }}
              >
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                  <StatusDot status={s.effectiveStatus} />
                  {s.learningStage === 'LIMITED' && (
                    <span style={{ ...sevPill, background: '#FEF3C7', color: '#B45309' }}>
                      учи (LIMITED)
                    </span>
                  )}
                  <span style={{ marginLeft: 'auto', fontSize: 12 }}>
                    <KpiInline kpi={s.kpi} resultLabel={c.resultLabel} />
                  </span>
                </div>
                {s.ads.map((ad) => (
                  <div
                    key={ad.metaId}
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: 8,
                      marginTop: 4,
                      paddingLeft: 12,
                    }}
                  >
                    <span style={{ fontSize: 12 }}>{ad.name}</span>
                    <StatusDot status={ad.effectiveStatus} />
                    {ad.reviewStatus === 'rejected' && (
                      <span style={{ ...sevPill, background: '#FEF2F2', color: '#B91C1C' }}>
                        одбиена
                      </span>
                    )}
                    <span
                      style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--gd-ink-muted)' }}
                    >
                      <KpiInline kpi={ad.kpi} resultLabel={c.resultLabel} />
                    </span>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function KpiInline({ kpi, resultLabel }: { kpi: Kpi; resultLabel: string }) {
  return (
    <>
      {fmtMoney(kpi.spend)} · {kpi.results.toLocaleString('mk-MK')} {resultLabel.toLowerCase()}
      {kpi.cpr != null ? ` · ${fmtMoney(kpi.cpr)}/рез` : ''}
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
  return <div style={{ padding: 40, color: 'var(--gd-ink-muted)' }}>Вчитување…</div>;
}
function Empty({ text }: { text: string }) {
  return (
    <div style={{ padding: 24, color: 'var(--gd-ink-muted)', textAlign: 'center' }}>{text}</div>
  );
}

// ─────────────────────────── Планови (§12) ───────────────────────────

const PLAN_FILTERS: Array<[string, string]> = [
  ['', 'Сите'],
  ['pending', 'На чекање'],
  ['approved', 'Одобрени'],
  ['syncing', 'Се проверуваат'],
  ['mismatch', 'Несовпаѓања'],
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
          + Нов план
        </button>
      </div>

      {isLoading && <Loading />}
      {!isLoading && plans.length === 0 && <Empty text="Нема планови." />}
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
  return (
    <div
      style={{
        ...rowCard,
        cursor: 'default',
        alignItems: 'flex-start',
        borderLeft: `3px solid ${PLAN_STATUS_COLOR[plan.status]}`,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 600, fontSize: 13 }}>
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
        {plan.consequences.length > 0 && (
          <div style={{ fontSize: 12, marginTop: 4 }}>{plan.consequences.join(' · ')}</div>
        )}
        {plan.warnings.length > 0 && (
          <div style={{ fontSize: 12, marginTop: 4, color: '#B45309' }}>
            ⚠ {plan.warnings.join(' · ')}
          </div>
        )}
        {plan.rejectNote && (
          <div style={{ fontSize: 12, marginTop: 4, color: '#B91C1C' }}>
            Одбиено: {plan.rejectNote}
          </div>
        )}
        <div style={{ fontSize: 11, color: 'var(--gd-ink-muted)', marginTop: 4 }}>
          {fmtDate(plan.createdAt)}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
        {canApprove && plan.status === 'pending' && (
          <>
            <button
              type="button"
              disabled={pending}
              style={{ ...ghostBtn, background: '#0866FF', color: '#fff', border: 'none' }}
              onClick={() => onAction('approve')}
            >
              Одобри
            </button>
            <button
              type="button"
              disabled={pending}
              style={ghostBtn}
              onClick={() => {
                const note = window.prompt('Причина за одбивање:');
                if (note?.trim()) onAction('reject', note);
              }}
            >
              Одбиј
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
            Повлечи
          </button>
        )}
      </div>
    </div>
  );
}

function CreatePlanModal({ onClose, draft }: { onClose: () => void; draft?: PlanDraft }) {
  const { data: clients = [] } = useMetaClients();
  const create = useCreatePlan();
  const [clientId, setClientId] = useState(draft?.clientId ?? '');
  const [op, setOp] = useState(draft?.op ?? 'O2');
  const [campaignId, setCampaignId] = useState(draft?.target.campaignId ?? '');
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
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Нов план за промена</div>
        <label style={modalLabel}>Клиент</label>
        <select style={modalInput} value={clientId} onChange={(e) => setClientId(e.target.value)}>
          <option value="">— избери —</option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <label style={modalLabel}>Операција</label>
        <select style={modalInput} value={op} onChange={(e) => setOp(e.target.value)}>
          {Object.entries(OP_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {code} · {label}
            </option>
          ))}
        </select>
        <label style={modalLabel}>Кампања (Meta ID)</label>
        <input
          style={modalInput}
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
        />
        {op === 'O2' && (
          <>
            <label style={modalLabel}>Нов дневен буџет (€)</label>
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
            <label style={modalLabel}>Ново име</label>
            <input style={modalInput} value={name} onChange={(e) => setName(e.target.value)} />
          </>
        )}
        <label style={modalLabel}>Белешка (опционо)</label>
        <input style={modalInput} value={note} onChange={(e) => setNote(e.target.value)} />
        <div style={{ fontSize: 11, color: 'var(--gd-ink-muted)', margin: '8px 0' }}>
          Планот не менува ништо во Meta — промената ја прави Директорот рачно во Ads Manager.
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
          <button type="button" style={ghostBtn} onClick={onClose}>
            Откажи
          </button>
          <button
            type="button"
            disabled={!clientId || create.isPending}
            style={{ ...ghostBtn, background: '#0866FF', color: '#fff', border: 'none' }}
            onClick={submit}
          >
            Создај
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────── Архива (§4.7) ───────────────────────────

function ArchiveView({ canExport, clientId }: { canExport: boolean; clientId?: string }) {
  const { data: rows = [], isLoading } = useMetaArchive(clientId);
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {canExport && (
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <a href="/api/meta/archive.csv" style={{ ...ghostBtn, textDecoration: 'none' }}>
            Извези CSV
          </a>
        </div>
      )}
      {isLoading && <Loading />}
      {!isLoading && rows.length === 0 && <Empty text="Нема записи во архивата." />}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {rows.map((r) => (
          <div
            key={r.id}
            style={{
              display: 'flex',
              gap: 10,
              padding: '8px 0',
              borderBottom: '1px solid var(--gd-border)',
              fontSize: 13,
            }}
          >
            <span style={{ color: 'var(--gd-ink-muted)', fontSize: 11, width: 130, flexShrink: 0 }}>
              {fmtDate(r.occurredAt)}
            </span>
            <span style={{ flex: 1 }}>{r.narrative}</span>
            <span style={{ color: 'var(--gd-ink-muted)', fontSize: 11, flexShrink: 0 }}>
              {r.actorRole ?? 'система'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────── AI помошник (§11) ───────────────────────────

interface ChatMsg {
  role: 'user' | 'assistant';
  text: string;
  draft?: PlanDraft | null;
}

function AssistantView({ isDir }: { isDir: boolean }) {
  const { data: clients = [] } = useMetaClients();
  const [clientId, setClientId] = useState('');
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
          setMessages((m) => [
            ...m,
            { role: 'assistant', text: 'Настана грешка. Обиди се повторно.' },
          ]),
      },
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ padding: 12, borderBottom: '1px solid var(--gd-border)' }}>
        <select
          style={{ ...modalInput, width: 260 }}
          value={clientId}
          onChange={(e) => setClientId(e.target.value)}
        >
          <option value="">Сите клиенти (за план избери еден)</option>
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
            Прашај за преглед, алерти, пресек или структура — или подготви план (пр. „буџет 200",
            „паузирај", „преименувај"). Помошникот само предлага; ти одлучуваш.
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
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  style={{ ...ghostBtn, background: '#0866FF', color: '#fff', border: 'none' }}
                  onClick={() => setDraftToOpen(m.draft!)}
                >
                  {isDir ? 'Отвори како план' : 'Прати на одобрување'}
                </button>
              </div>
            )}
          </div>
        ))}
        {chat.isPending && (
          <div style={{ color: 'var(--gd-ink-muted)', fontSize: 12 }}>Пишува…</div>
        )}
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
          Прати
        </button>
      </div>

      {draftToOpen && <CreatePlanModal draft={draftToOpen} onClose={() => setDraftToOpen(null)} />}
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
