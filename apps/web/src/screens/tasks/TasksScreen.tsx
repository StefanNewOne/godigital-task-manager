import type React from 'react';
import { useState } from 'react';
import { useMe } from '../../api/auth.js';
import { useClients } from '../../api/admin.js';
import { useTasks } from '../../api/tasks.js';
import type { TaskListItem } from '../../lib/types.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { TaskDetail } from './TaskDetail.js';
import { Board } from './Board.js';

type Tab = 'my' | 'list' | 'board';

const TAB_LABEL: Record<Tab, string> = { my: 'Мои задачи', list: 'Список', board: 'Табла' };

export function TasksScreen() {
  const { data: me } = useMe();
  const [tab, setTab] = useState<Tab>('my');
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: clients } = useClients();
  const myTasks = useTasks(me ? { assigneeId: me.id } : {});
  const allTasks = useTasks({});
  const tasks = (tab === 'my' ? myTasks.data : allTasks.data) ?? [];

  const clientOf = (id: string) => clients?.find((c) => c.id === id);

  // Список: групирано по клиент.
  const groups =
    tab === 'list'
      ? Object.entries(
          tasks.reduce<Record<string, TaskListItem[]>>((acc, t) => {
            (acc[t.clientId] ??= []).push(t);
            return acc;
          }, {}),
        )
      : [['', tasks] as [string, TaskListItem[]]];

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 20px' }}>
        <div
          style={{
            display: 'flex',
            gap: 16,
            marginBottom: 16,
            borderBottom: '1px solid var(--gd-border)',
          }}
        >
          {(['my', 'list', 'board'] as Tab[]).map((t) => (
            <button key={t} onClick={() => setTab(t)} style={tabBtn(tab === t)}>
              {TAB_LABEL[t]}
            </button>
          ))}
        </div>

        {tab === 'board' && <Board onOpen={setOpenId} />}

        {tab !== 'board' && tasks.length === 0 && (
          <p style={{ color: 'var(--gd-ink-muted)' }}>Нема задачи за приказ.</p>
        )}

        {tab !== 'board' &&
          groups.map(([clientId, rows]) => (
            <div key={clientId || 'all'} style={{ marginBottom: 20 }}>
              {tab === 'list' && (
                <div style={groupHeader}>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      background: clientOf(clientId)?.color ?? '#ccc',
                    }}
                  />
                  {clientOf(clientId)?.name ?? 'Клиент'}{' '}
                  <span style={{ color: 'var(--gd-ink-muted)' }}>· {rows.length}</span>
                </div>
              )}
              <div style={card}>
                {rows.map((t) => (
                  <button key={t.id} onClick={() => setOpenId(t.id)} style={row(openId === t.id)}>
                    <span
                      style={{
                        width: 3,
                        height: 24,
                        borderRadius: 2,
                        background: clientOf(t.clientId)?.color ?? '#ccc',
                      }}
                    />
                    <span style={{ fontSize: 16, width: 18 }}>
                      {t.contentType === 'video' ? '▶' : '▧'}
                    </span>
                    <span
                      style={{
                        flex: 1,
                        fontWeight: 500,
                        textAlign: 'left',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t.title}
                    </span>
                    <StatusBadge status={t.status} />
                    <span
                      style={{
                        width: 88,
                        textAlign: 'right',
                        color: 'var(--gd-ink-muted)',
                        fontSize: 13,
                      }}
                    >
                      {t.slot ? t.slot.date.slice(0, 10) : '—'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
      </div>

      {openId && <TaskDetail taskId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

const tabBtn = (active: boolean): React.CSSProperties => ({
  padding: '8px 4px',
  border: 'none',
  background: 'transparent',
  borderBottom: active ? '2px solid var(--gd-primary)' : '2px solid transparent',
  color: active ? 'var(--gd-ink)' : 'var(--gd-ink-muted)',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
});
const groupHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
  fontWeight: 600,
  margin: '0 0 8px',
};
const card: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  background: 'var(--gd-surface)',
  overflow: 'hidden',
};
const row = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  width: '100%',
  height: 44,
  padding: '0 16px',
  border: 'none',
  borderBottom: '1px solid var(--gd-border)',
  background: active ? 'var(--gd-primary-tint)' : 'transparent',
  cursor: 'pointer',
});
