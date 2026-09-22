import type React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  BarChart3,
  Building2,
  Calendar as CalendarIcon,
  LayoutDashboard,
  ListChecks,
  LogOut,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { PERMISSIONS, type Role, type Screen } from '@gd/core';
import { Button } from '@gd/ui';
import { useLogout, useMe } from '../api/auth.js';
import { NotificationsBell } from './NotificationsBell.js';

const NAV: Array<{ screen: Screen; icon: LucideIcon; label: string; path: string }> = [
  { screen: 'director', icon: LayoutDashboard, label: 'Преглед', path: '/' },
  { screen: 'list', icon: ListChecks, label: 'Задачи', path: '/tasks' },
  { screen: 'calendar', icon: CalendarIcon, label: 'Календар', path: '/calendar' },
  { screen: 'clients', icon: Building2, label: 'Клиенти', path: '/clients' },
  { screen: 'analytics', icon: BarChart3, label: 'Аналитика', path: '/analytics' },
  { screen: 'admin', icon: Settings, label: 'Админ', path: '/admin' },
];

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

const ROLE_SHORT: Record<Role, string> = {
  dir: 'Директор',
  rez: 'Режисер',
  scen: 'Сценарист',
  kam: 'Камерман',
  mon: 'Монтажер',
  krea: 'Гр. креатор',
  diz: 'Гр. дизајнер',
  am: 'Акаунт мен.',
  ana: 'Аналитичар',
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase();
}

export function AppShell() {
  const { data: me } = useMe();
  const logout = useLogout();
  const loc = useLocation();
  const visible = me ? NAV.filter((n) => PERMISSIONS[me.role].nav.includes(n.screen)) : [];
  const active =
    [...visible]
      .sort((a, b) => b.path.length - a.path.length)
      .find((n) => (n.path === '/' ? loc.pathname === '/' : loc.pathname.startsWith(n.path))) ??
    visible[0];

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
              <span
                style={{
                  fontSize: 9,
                  lineHeight: '10px',
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                }}
              >
                {n.label}
              </span>
            </NavLink>
          );
        })}
      </nav>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Топ лента 56px — наслов по контекст + акции */}
        <header style={topBar}>
          <h1 style={{ fontSize: 18, lineHeight: '26px', fontWeight: 600, margin: 0 }}>
            {active?.label ?? 'GoDigital'}
          </h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NotificationsBell />
            {me && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={avatar(AVATAR_COLOR[me.role])}>{initials(me.name)}</span>
                <div style={{ lineHeight: 1.2 }}>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>{me.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>
                    {ROLE_SHORT[me.role]}
                  </div>
                </div>
              </div>
            )}
            <Button
              variant="ghost"
              size="toolbar"
              onClick={() => logout.mutate()}
              title="Одјава"
              aria-label="Одјава"
            >
              <LogOut size={16} aria-hidden />
            </Button>
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'auto', background: 'var(--gd-surface-alt)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const rail: React.CSSProperties = {
  width: 64,
  flex: '0 0 64px',
  background: 'var(--gd-surface)',
  borderRight: '1px solid var(--gd-border)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '12px 0',
  gap: 4,
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
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 20px',
};

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
});
