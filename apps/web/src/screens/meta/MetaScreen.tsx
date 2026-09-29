import type React from 'react';
import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  type Kpi,
  type MetaAlertRow,
  type MetaCommentRow,
  type MetaConversationRow,
} from '../../api/meta.js';

type MetaTab = 'overview' | 'clients' | 'cross' | 'inbox' | 'comments';

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

  if (!me) return null;

  // Инбокс + Коментари се достапни за сите три улоги; управувачките табови само за dir/ana (§3).
  const isManager = me.role === 'dir' || me.role === 'ana';
  const tabs: Array<[MetaTab, string]> = isManager
    ? [
        ['overview', 'Утрински преглед'],
        ['clients', 'Клиенти'],
        ['cross', 'Пресек'],
        ['inbox', 'Инбокс'],
        ['comments', 'Коментари'],
      ]
    : [
        ['inbox', 'Инбокс'],
        ['comments', 'Коментари'],
      ];

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

      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {openClient ? (
          <StructureView clientId={openClient} onBack={() => setOpenClient(null)} />
        ) : tab === 'overview' ? (
          <OverviewView />
        ) : tab === 'clients' ? (
          <ClientsView onOpen={setOpenClient} />
        ) : tab === 'cross' ? (
          <CrossView />
        ) : tab === 'inbox' ? (
          <InboxView />
        ) : (
          <CommentsView />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────── Инбокс ───────────────────────────

const CHANNEL_LABEL: Record<string, string> = { messenger: 'Messenger', instagram: 'Instagram' };

function InboxView() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: convos = [], isLoading } = useMetaConversations(undefined, unreadOnly);

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
      <div style={{ fontSize: 11, color: 'var(--gd-ink-muted)' }}>
        Само читање — одговарај директно во Meta Business Suite.
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

function CommentsView() {
  const [filter, setFilter] = useState('');
  const { data: comments = [], isLoading } = useMetaComments(undefined, filter || undefined);
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
            <span style={{ ...sevPill, background: '#EBF2FF', color: '#0052D9' }}>реклама</span>
          )}
          {comment.isQuestion && (
            <span style={{ ...sevPill, background: '#FEF3C7', color: '#B45309' }}>прашање</span>
          )}
          {comment.isComplaint && (
            <span style={{ ...sevPill, background: '#FEF2F2', color: '#B91C1C' }}>поплака</span>
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

function OverviewView() {
  const { data: ov } = useMetaOverview();
  const { data: alerts = [] } = useMetaAlerts();
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
    </div>
  );
}

function CrossView() {
  const [period, setPeriod] = useState('7');
  const { data } = useMetaCross(period);
  return (
    <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          ['7', '7 дена'],
          ['30', '30 дена'],
          ['month', 'Овој месец'],
        ].map(([p, label]) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p!)}
            style={tabStyle(period === p)}
          >
            {label}
          </button>
        ))}
      </div>
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
    </div>
  );
}

function StructureView({ clientId, onBack }: { clientId: string; onBack: () => void }) {
  const [period, setPeriod] = useState('7');
  const { data } = useMetaStructure(clientId, period);
  return (
    <div style={{ padding: 20 }}>
      <button type="button" onClick={onBack} style={{ ...ghostBtn, marginBottom: 12 }}>
        ← Назад на клиенти
      </button>
      <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
        {[
          ['7', '7 дена'],
          ['30', '30 дена'],
          ['month', 'Овој месец'],
        ].map(([p, label]) => (
          <button
            key={p}
            type="button"
            onClick={() => setPeriod(p!)}
            style={tabStyle(period === p)}
          >
            {label}
          </button>
        ))}
      </div>
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
