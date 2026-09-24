import type React from 'react';
import { useState } from 'react';
import { NavLink, Outlet, useLocation, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { PERMISSIONS, type Role, type Screen } from '@gd/core';
import { useLogout, useMe } from '../api/auth.js';
import { MONTH_LABELS } from '../lib/calendar.js';
import { NotificationsBell } from './NotificationsBell.js';
import { KritichenModal } from './KritichenModal.js';
import { AssistantPanel } from './AssistantPanel.js';

// `label` = кратка ознака во rail-от; `title` = наслов во топ-лентата (Handoff).
const NAV: Array<{
  screen: Screen;
  icon: LucideIcon;
  label: string;
  title?: string;
  path: string;
}> = [
  {
    screen: 'director',
    icon: LayoutDashboard,
    label: 'Преглед',
    title: 'Директорски преглед',
    path: '/',
  },
  { screen: 'list', icon: ListChecks, label: 'Задачи', path: '/tasks' },
  {
    screen: 'calendar',
    icon: CalendarIcon,
    label: 'Календар',
    title: 'Календар на објави',
    path: '/calendar',
  },
  { screen: 'clients', icon: Building2, label: 'Клиенти', path: '/clients' },
  { screen: 'analytics', icon: BarChart3, label: 'Аналитика', path: '/analytics' },
  { screen: 'admin', icon: Settings, label: 'Админ', path: '/admin' },
];

const TASK_TABS = [
  { key: 'my', label: 'Мои задачи' },
  { key: 'list', label: 'Список' },
  { key: 'board', label: 'Табла' },
] as const;

// Екрани што носат 240px контекст-панел + неговото заглавие во топ-стрипот.
const SIDEBAR_LABEL: Partial<Record<Screen, string>> = {
  director: 'Преглед',
  list: 'Работа',
  clients: 'Клиенти',
};

/** Боја на аватар по улога (Handoff §Employee Avatar Colors). */
const AVATAR_COLOR: Record<Role, string> = {
  dir: '#0866FF',
  rez: '#7C3AED',
  scen: '#0284C7',
  kam: '#0D9488',
  mon: '#D97706',
  krea: '#0EA5E9',
  diz: '#65A30D',
  am: '#DB2777',
  ana: '#DC2626',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function AppShell() {
  const { data: me } = useMe();
  const logout = useLogout();
  const loc = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [asking, setAsking] = useState(false);

  const visible = me ? NAV.filter((n) => PERMISSIONS[me.role].nav.includes(n.screen)) : [];
  const active =
    [...visible]
      .sort((a, b) => b.path.length - a.path.length)
      .find((n) => (n.path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.path))) ??
    visible[0];

  const onTasks = loc.pathname.startsWith('/tasks');
  const currentTab = searchParams.get('tab') ?? 'my';
  const month = MONTH_LABELS[new Date().getUTCMonth()];
  const title = onTasks
    ? `GoDigital V.2 · ${month}`
    : (active?.title ?? active?.label ?? 'GoDigital');

  // Контекст-панелот (240px) го носи екранот; заглавието стои во истиот топ-стрип,
  // порамнето над панелот (Handoff). Собирањето се води преку ?sb=0.
  const sidebarLabel = active ? SIDEBAR_LABEL[active.screen] : undefined;
  const hasSidebar = !!sidebarLabel;
  const sidebarCollapsed = searchParams.get('sb') === '0';
  const toggleSidebar = () => {
    const next = new URLSearchParams(searchParams);
    if (sidebarCollapsed) next.delete('sb');
    else next.set('sb', '0');
    setSearchParams(next);
  };

  const setTab = (key: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('tab', key);
    setSearchParams(next);
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Иконска лента 64px */}
      <nav style={rail}>
        <div style={logo}>GD</div>
        {visible.map((n) => {
          const Icon = n.icon;
          return (
            <NavLink
              key={n.screen}
              to={n.path}
              title={n.label}
              style={railLink}
              end={n.path === '/'}
            >
              <Icon size={20} strokeWidth={2} aria-hidden />
              <span style={railLabel}>{n.label}</span>
            </NavLink>
          );
        })}
        {me && (
          <div style={railBottom}>
            <NavLink
              to="/settings"
              style={avatar(AVATAR_COLOR[me.role])}
              title={`${me.name} · Поставки`}
              aria-label="Поставки"
            >
              {initials(me.name)}
            </NavLink>
            <button
              onClick={() => logout.mutate()}
              style={railLogout}
              title="Одјава"
              aria-label="Одјава"
            >
              <LogOut size={16} aria-hidden />
            </button>
          </div>
        )}
      </nav>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Топ стрип 56px — [панел-заглавие 240px][бренд + табови ··· Аларми] */}
        <header style={topBar}>
          {hasSidebar && !sidebarCollapsed && (
            <div style={sidebarHeaderSeg}>
              <span>{sidebarLabel}</span>
              <button
                onClick={toggleSidebar}
                style={collapseBtn}
                title="Собери"
                aria-label="Собери го панелот"
              >
                <ChevronLeft size={16} aria-hidden />
              </button>
            </div>
          )}
          <div style={topBarMain}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, minWidth: 0 }}>
              {hasSidebar && sidebarCollapsed && (
                <button
                  onClick={toggleSidebar}
                  style={collapseBtn}
                  title="Отвори"
                  aria-label="Отвори го панелот"
                >
                  <ChevronRight size={16} aria-hidden />
                </button>
              )}
              <h1 style={brandTitle}>{title}</h1>
              {onTasks && (
                <div style={{ display: 'flex', gap: 4 }}>
                  {TASK_TABS.map((t) => (
                    <button
                      key={t.key}
                      onClick={() => setTab(t.key)}
                      style={tabBtn(currentTab === t.key)}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button
                onClick={() => setAsking(true)}
                style={askTopBtn}
                title="Прашај го помошникот"
                aria-label="Прашај го помошникот"
              >
                <Sparkles size={14} aria-hidden /> Прашај
              </button>
              <NotificationsBell />
              {me && PERMISSIONS[me.role].nav.includes('admin') && (
                <NavLink to="/admin" style={topBarLink}>
                  Админ
                </NavLink>
              )}
            </div>
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'auto', background: 'var(--gd-surface-alt)' }}>
          <Outlet />
        </main>
      </div>
      <KritichenModal />
      {asking && <AssistantPanel onClose={() => setAsking(false)} />}
    </div>
  );
}

const rail: React.CSSProperties = {
  width: 64,
  flex: '0 0 64px',
  background: 'var(--gd-surface-alt)',
  borderRight: '1px solid var(--gd-border)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '12px 0',
  gap: 4,
};

const railBottom: React.CSSProperties = {
  marginTop: 'auto',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: 6,
  paddingTop: 8,
};

const logo: React.CSSProperties = {
  width: 32,
  height: 32,
  borderRadius: 8,
  background: 'var(--gd-primary)',
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
  fontSize: 12,
  marginBottom: 8,
};

const topBar: React.CSSProperties = {
  height: 56,
  flex: '0 0 56px',
  background: 'var(--gd-surface)',
  borderBottom: '1px solid var(--gd-border)',
  display: 'flex',
  alignItems: 'stretch',
};

const sidebarHeaderSeg: React.CSSProperties = {
  width: 240,
  flex: '0 0 240px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 12px 0 16px',
  borderRight: '1px solid var(--gd-border)',
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--gd-ink-secondary)',
};

const topBarMain: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 20px',
};

const askTopBtn: React.CSSProperties = {
  height: 32,
  padding: '0 12px',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--gd-brand)',
  background: 'var(--gd-surface)',
  cursor: 'pointer',
};
const topBarLink: React.CSSProperties = {
  height: 32,
  padding: '0 12px',
  display: 'inline-flex',
  alignItems: 'center',
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--gd-ink)',
  textDecoration: 'none',
  background: 'var(--gd-surface)',
};
const collapseBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 24,
  height: 24,
  border: 'none',
  background: 'transparent',
  color: 'var(--gd-ink-muted)',
  cursor: 'pointer',
  borderRadius: 6,
};

const brandTitle: React.CSSProperties = {
  fontSize: 18,
  lineHeight: '26px',
  fontWeight: 600,
  margin: 0,
  whiteSpace: 'nowrap',
};

const tabBtn = (activeTab: boolean): React.CSSProperties => ({
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: 14,
  fontWeight: activeTab ? 600 : 500,
  color: activeTab ? 'var(--gd-primary)' : 'var(--gd-ink-secondary)',
  padding: '0 4px',
  height: 56,
  borderBottom: activeTab ? '2px solid var(--gd-primary)' : '2px solid transparent',
});

const railLink = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  width: 48,
  height: 48,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 3,
  borderRadius: 8,
  textDecoration: 'none',
  color: isActive ? 'var(--gd-primary-hover)' : 'var(--gd-ink-secondary)',
  background: isActive ? 'var(--gd-primary-tint)' : 'transparent',
});

const railLabel: React.CSSProperties = {
  fontSize: 9,
  lineHeight: '10px',
  fontWeight: 500,
  letterSpacing: '-0.01em',
};

const railLogout: React.CSSProperties = {
  width: 32,
  height: 32,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 'none',
  background: 'transparent',
  color: 'var(--gd-ink-muted)',
  cursor: 'pointer',
  borderRadius: 8,
};

const avatar = (bg: string): React.CSSProperties => ({
  width: 32,
  height: 32,
  borderRadius: '50%',
  background: bg,
  color: '#fff',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 12,
  fontWeight: 600,
  flex: '0 0 auto',
  textDecoration: 'none',
});
