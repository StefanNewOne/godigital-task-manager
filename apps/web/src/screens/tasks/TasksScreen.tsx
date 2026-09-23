import type React from 'react';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ALL_STATUSES,
  GROUP_STATUS_META,
  TASK_STATUS_META,
  canCreate,
  type TaskStatus,
} from '@gd/core';
import { Button } from '@gd/ui';
import {
  ArrowDownUp,
  Filter as FilterIcon,
  LayoutGrid,
  Plus,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import { useMe } from '../../api/auth.js';
import { useClients, useEmployees } from '../../api/admin.js';
import { useOverview } from '../../api/overview.js';
import { useTasks } from '../../api/tasks.js';
import { useTaskGroups } from '../../api/taskGroups.js';
import type { TaskListItem } from '../../lib/types.js';
import { daysUntil } from '../../lib/tasksView.js';
import { TaskDetail } from './TaskDetail.js';
import { CapaPanel } from './CapaPanel.js';
import { Board } from './Board.js';
import { ListView } from './ListView.js';
import { MyTasks } from './MyTasks.js';

type Tab = 'my' | 'list' | 'board';
const monthOf = (iso: string | null | undefined) => (iso ? iso.slice(0, 7) : null);

export function TasksScreen() {
  const { data: me } = useMe();
  const { data: clients } = useClients();
  const { data: employees } = useEmployees();
  const { data: overview } = useOverview();
  const allTasks = useTasks({});
  const myTasks = useTasks(me ? { assigneeId: me.id } : {});

  // Табот е во топ-лентата (AppShell) и се води преку URL ?tab=; тука само го читаме.
  const [searchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: Tab = tabParam === 'list' || tabParam === 'board' ? tabParam : 'my';
  const [openId, setOpenId] = useState<string | null>(null);
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [clientId, setClientId] = useState(() => searchParams.get('client') ?? '');
  const [months, setMonths] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Set<string>>(() => {
    const s = searchParams.get('status');
    return s ? new Set([s]) : new Set();
  });
  const [search, setSearch] = useState('');
  const [groupBy, setGroupBy] = useState<'client' | 'status'>('client');
  const [sortBy, setSortBy] = useState<'date' | 'client' | 'status'>('date');
  const [compact, setCompact] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);

  const clientById = useMemo(() => new Map((clients ?? []).map((c) => [c.id, c])), [clients]);
  const empById = useMemo(() => new Map((employees ?? []).map((e) => [e.id, e])), [employees]);
  const coverageById = useMemo(
    () => new Map((overview?.coverage ?? []).map((c) => [c.clientId, c])),
    [overview],
  );

  const source = tab === 'my' ? (myTasks.data ?? []) : (allTasks.data ?? []);

  const monthOptions = useMemo(() => {
    const set = new Set<string>();
    for (const t of allTasks.data ?? []) {
      const m = monthOf(t.slot?.date);
      if (m) set.add(m);
    }
    return [...set].sort().reverse();
  }, [allTasks.data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = source.filter((t) => {
      if (clientId && t.clientId !== clientId) return false;
      if (statuses.size > 0 && !statuses.has(t.status)) return false;
      if (months.size > 0) {
        const m = monthOf(t.slot?.date);
        if (!m || !months.has(m)) return false;
      }
      if (q) {
        const name = clientById.get(t.clientId)?.name.toLowerCase() ?? '';
        if (!t.title.toLowerCase().includes(q) && !name.includes(q)) return false;
      }
      return true;
    });
    return sortTasks(rows, sortBy, clientById);
  }, [source, clientId, statuses, months, search, sortBy, clientById]);

  const effectiveGroupBy = clientId ? 'status' : groupBy;
  const canCreateVideo = !!me && canCreate(me.role, 'video');
  const canCreateGraphic = !!me && canCreate(me.role, 'graphic');
  const [toast, setToast] = useState<string | null>(null);

  const groupsQ = useTaskGroups({
    clientId: clientId || undefined,
    month: months.size === 1 ? [...months][0] : undefined,
  });

  // Отворени капи што ги носи мојата улога (за резимето во „Мои задачи").
  const myCapaCount = me
    ? (groupsQ.data ?? []).filter(
        (g) =>
          g.status !== 'zatvoren' &&
          GROUP_STATUS_META[g.status as keyof typeof GROUP_STATUS_META]?.owner === me.role,
      ).length
    : 0;

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      {/* Контекст sidebar 240px */}
      {sidebarOpen && (
        <aside style={sidebar}>
          <SidebarGroup label="Месеци">
            {monthOptions.map((m) => (
              <label key={m} style={checkRow}>
                <input
                  type="checkbox"
                  checked={months.has(m)}
                  onChange={() => setMonths((s) => toggle(s, m))}
                />
                {m}
                <span style={{ marginLeft: 'auto', color: 'var(--gd-ink-muted)' }}>
                  {(allTasks.data ?? []).filter((t) => monthOf(t.slot?.date) === m).length}
                </span>
              </label>
            ))}
          </SidebarGroup>
          <SidebarGroup label="Клиенти">
            <button style={clientRow(clientId === '')} onClick={() => setClientId('')}>
              Сите клиенти
            </button>
            {(clients ?? []).map((c) => (
              <button
                key={c.id}
                style={clientRow(clientId === c.id)}
                onClick={() => setClientId(c.id)}
              >
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
                {c.name}
                <span style={{ marginLeft: 'auto', color: 'var(--gd-ink-muted)' }}>
                  {(allTasks.data ?? []).filter((t) => t.clientId === c.id).length}
                </span>
              </button>
            ))}
          </SidebarGroup>
        </aside>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Toolbar 48px */}
        <Toolbar
          canCreateVideo={canCreateVideo}
          canCreateGraphic={canCreateGraphic}
          onCreate={(k) => setToast(`Креирање ${k} доаѓа со Капа панелот.`)}
          tab={tab}
          groupBy={groupBy}
          onGroupBy={() => setGroupBy((g) => (g === 'client' ? 'status' : 'client'))}
          clientId={clientId}
          clients={clients ?? []}
          onClient={setClientId}
          sortBy={sortBy}
          onSort={() =>
            setSortBy((s) => (s === 'date' ? 'client' : s === 'client' ? 'status' : 'date'))
          }
          compact={compact}
          onCompact={() => setCompact((c) => !c)}
          filterOpen={filterOpen}
          onToggleFilter={() => setFilterOpen((f) => !f)}
          onToggleSidebar={() => setSidebarOpen((s) => !s)}
          search={search}
          onSearch={setSearch}
          months={months}
          setMonths={setMonths}
          statuses={statuses}
          setStatuses={setStatuses}
          monthOptions={monthOptions}
        />

        <main style={{ flex: 1, overflow: 'auto', padding: '20px' }}>
          {tab === 'my' && (
            <MyTasks
              tasks={filtered}
              capaCount={myCapaCount}
              clientById={clientById}
              openId={openId}
              onOpen={setOpenId}
            />
          )}
          {tab === 'list' && (
            <ListView
              tasks={filtered}
              groups={groupsQ.data ?? []}
              clientById={clientById}
              empById={empById}
              coverageById={coverageById}
              grouped={!clientId}
              compact={compact}
              openId={openId}
              onOpen={setOpenId}
              onOpenCapa={setOpenGroupId}
            />
          )}
          {tab === 'board' && (
            <Board
              tasks={filtered}
              clientById={clientById}
              empById={empById}
              groupBy={effectiveGroupBy}
              onOpen={setOpenId}
            />
          )}
        </main>
      </div>

      {openId && <TaskDetail taskId={openId} onClose={() => setOpenId(null)} />}
      {openGroupId && <CapaPanel groupId={openGroupId} onClose={() => setOpenGroupId(null)} />}
      {toast && (
        <div style={toastStyle} onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  );
}

// --- Toolbar --------------------------------------------------------------

interface ToolbarProps {
  canCreateVideo: boolean;
  canCreateGraphic: boolean;
  onCreate: (kind: string) => void;
  tab: Tab;
  groupBy: 'client' | 'status';
  onGroupBy: () => void;
  clientId: string;
  clients: { id: string; name: string }[];
  onClient: (id: string) => void;
  sortBy: 'date' | 'client' | 'status';
  onSort: () => void;
  compact: boolean;
  onCompact: () => void;
  filterOpen: boolean;
  onToggleFilter: () => void;
  onToggleSidebar: () => void;
  search: string;
  onSearch: (v: string) => void;
  months: Set<string>;
  setMonths: React.Dispatch<React.SetStateAction<Set<string>>>;
  statuses: Set<string>;
  setStatuses: React.Dispatch<React.SetStateAction<Set<string>>>;
  monthOptions: string[];
}

function Toolbar(p: ToolbarProps) {
  const SORT_LABEL = { date: 'датум', client: 'клиент', status: 'статус' } as const;
  return (
    <div style={toolbar}>
      <div style={{ display: 'flex', gap: 8 }}>
        {p.canCreateVideo && (
          <Button size="toolbar" onClick={() => p.onCreate('видео')}>
            <Plus size={14} /> Ново видео
          </Button>
        )}
        {p.canCreateGraphic && (
          <Button size="toolbar" onClick={() => p.onCreate('графика')}>
            <Plus size={14} /> Нова графика
          </Button>
        )}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginLeft: 'auto' }}>
        {(p.tab === 'board' || p.tab === 'list') && (
          <Button variant="secondary" size="toolbar" onClick={p.onGroupBy}>
            <LayoutGrid size={14} /> {p.groupBy === 'client' ? 'по клиент' : 'по статус'}
          </Button>
        )}
        <select
          value={p.clientId}
          onChange={(e) => p.onClient(e.target.value)}
          className="gd-field"
          style={{ width: 160, height: 28 }}
        >
          <option value="">Сите клиенти</option>
          {p.clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <div style={{ position: 'relative' }}>
          <Button variant="secondary" size="toolbar" onClick={p.onToggleFilter}>
            <FilterIcon size={14} /> Филтер
          </Button>
          {p.filterOpen && (
            <div style={filterPopover}>
              <div style={popTitle}>Месеци</div>
              {p.monthOptions.map((m) => (
                <label key={m} style={checkRow}>
                  <input
                    type="checkbox"
                    checked={p.months.has(m)}
                    onChange={() => p.setMonths((s) => toggle(s, m))}
                  />
                  {m}
                </label>
              ))}
              <div style={{ ...popTitle, marginTop: 8 }}>Статус</div>
              <div style={{ maxHeight: 160, overflow: 'auto' }}>
                {ALL_STATUSES.map((s) => (
                  <label key={s} style={checkRow}>
                    <input
                      type="checkbox"
                      checked={p.statuses.has(s)}
                      onChange={() => p.setStatuses((x) => toggle(x, s))}
                    />
                    {TASK_STATUS_META[s as TaskStatus].label}
                  </label>
                ))}
              </div>
              <button
                style={clearBtn}
                onClick={() => {
                  p.setMonths(new Set());
                  p.setStatuses(new Set());
                }}
              >
                Исчисти филтри
              </button>
            </div>
          )}
        </div>
        <Button variant="secondary" size="toolbar" onClick={p.onSort}>
          <ArrowDownUp size={14} /> {SORT_LABEL[p.sortBy]}
        </Button>
        <Button variant="secondary" size="toolbar" onClick={p.onCompact} title="Компактно">
          <SlidersHorizontal size={14} /> {p.compact ? 'збиено' : 'нормално'}
        </Button>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search
            size={14}
            style={{ position: 'absolute', left: 8, color: 'var(--gd-ink-muted)' }}
          />
          <input
            value={p.search}
            onChange={(e) => p.onSearch(e.target.value)}
            placeholder="Пребарај…"
            className="gd-field"
            style={{ width: 180, height: 28, paddingLeft: 28 }}
          />
        </div>
      </div>
    </div>
  );
}

function SidebarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={sidebarLabel}>{label}</div>
      {children}
    </div>
  );
}

// --- helpers --------------------------------------------------------------

function toggle(set: Set<string>, v: string): Set<string> {
  const n = new Set(set);
  if (n.has(v)) n.delete(v);
  else n.add(v);
  return n;
}

function sortTasks(
  rows: TaskListItem[],
  by: 'date' | 'client' | 'status',
  clientById: Map<string, { name: string }>,
): TaskListItem[] {
  const arr = [...rows];
  if (by === 'date') {
    arr.sort((a, b) => (daysUntil(a.slot?.date) ?? 1e9) - (daysUntil(b.slot?.date) ?? 1e9));
  } else if (by === 'client') {
    arr.sort((a, b) =>
      (clientById.get(a.clientId)?.name ?? '').localeCompare(
        clientById.get(b.clientId)?.name ?? '',
      ),
    );
  } else {
    arr.sort(
      (a, b) => ALL_STATUSES.indexOf(a.status as never) - ALL_STATUSES.indexOf(b.status as never),
    );
  }
  return arr;
}

// --- styles ---------------------------------------------------------------

const sidebar: React.CSSProperties = {
  width: 240,
  flex: '0 0 240px',
  borderRight: '1px solid var(--gd-border)',
  background: 'var(--gd-surface)',
  padding: 16,
  overflow: 'auto',
};
const sidebarLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--gd-ink-muted)',
  padding: '0 4px 8px',
};
const checkRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  padding: '4px',
  cursor: 'pointer',
};
const clientRow = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '6px 8px',
  border: 'none',
  borderRadius: 6,
  background: active ? 'var(--gd-primary-tint)' : 'transparent',
  color: active ? 'var(--gd-primary-hover)' : 'var(--gd-ink)',
  fontWeight: active ? 600 : 400,
  fontSize: 13,
  cursor: 'pointer',
  textAlign: 'left',
});
const toolbar: React.CSSProperties = {
  height: 48,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 20px',
  borderBottom: '1px solid var(--gd-border)',
  background: 'var(--gd-surface)',
};
const filterPopover: React.CSSProperties = {
  position: 'absolute',
  top: 34,
  right: 0,
  width: 280,
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  boxShadow: 'var(--gd-shadow-popover)',
  padding: 12,
  zIndex: 20,
};
const popTitle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--gd-ink-muted)',
  marginBottom: 4,
};
const clearBtn: React.CSSProperties = {
  marginTop: 8,
  border: 'none',
  background: 'transparent',
  color: 'var(--gd-primary)',
  fontSize: 13,
  cursor: 'pointer',
  padding: 4,
};
const toastStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 20,
  right: 20,
  background: '#12161C',
  color: '#fff',
  padding: '10px 16px',
  borderRadius: 8,
  fontSize: 14,
  cursor: 'pointer',
  zIndex: 50,
};
