import type React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { PERMISSIONS, type Screen } from '@gd/core';
import { useLogout, useMe } from '../api/auth.js';
import { NotificationsBell } from './NotificationsBell.js';

const NAV: Array<{ screen: Screen; icon: string; label: string; path: string }> = [
  { screen: 'director', icon: '⌂', label: 'Преглед', path: '/' },
  { screen: 'list', icon: '☑', label: 'Задачи', path: '/tasks' },
  { screen: 'calendar', icon: '▦', label: 'Календар', path: '/calendar' },
  { screen: 'clients', icon: '◍', label: 'Клиенти', path: '/clients' },
  { screen: 'analytics', icon: '◔', label: 'Аналитика', path: '/analytics' },
  { screen: 'admin', icon: '⚙', label: 'Админ', path: '/admin' },
];

export function AppShell() {
  const { data: me } = useMe();
  const logout = useLogout();
  const visible = me ? NAV.filter((n) => PERMISSIONS[me.role].nav.includes(n.screen)) : [];

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      {/* Иконска лента 64px */}
      <nav
        style={{
          width: 64,
          background: 'var(--gd-surface-alt)',
          borderRight: '1px solid var(--gd-border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '12px 0',
          gap: 4,
        }}
      >
        <div
          style={{
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
          }}
        >
          GD
        </div>
        {visible.map((n) => (
          <NavLink key={n.screen} to={n.path} title={n.label} style={railLink} end={n.path === '/'}>
            <span style={{ fontSize: 18 }}>{n.icon}</span>
            <span style={{ fontSize: 9, fontWeight: 500 }}>{n.label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Топ лента 56px */}
        <header
          style={{
            height: 56,
            borderBottom: '1px solid var(--gd-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 20px',
          }}
        >
          <strong style={{ fontSize: 16 }}>GoDigital Таск-менаџер</strong>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <NotificationsBell />
            {me && (
              <span style={{ fontSize: 13, color: 'var(--gd-ink-muted)' }}>
                {me.name} · {me.role}
              </span>
            )}
            <button onClick={() => logout.mutate()} style={logoutBtn}>
              Одјава
            </button>
          </div>
        </header>

        <main style={{ flex: 1, overflow: 'auto', background: 'var(--gd-surface-alt)' }}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

const railLink = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  width: 48,
  height: 48,
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  borderRadius: 8,
  textDecoration: 'none',
  color: isActive ? 'var(--gd-primary-hover)' : 'var(--gd-ink-secondary)',
  background: isActive ? 'var(--gd-primary-tint)' : 'transparent',
});

const logoutBtn: React.CSSProperties = {
  height: 28,
  padding: '0 12px',
  border: '1px solid var(--gd-border)',
  borderRadius: 'var(--gd-radius-button)',
  background: 'var(--gd-surface)',
  fontSize: 13,
  cursor: 'pointer',
};
