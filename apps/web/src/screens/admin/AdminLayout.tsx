import type React from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';

const SECTIONS = [
  { path: '/admin/clients', label: 'Клиенти' },
  { path: '/admin/employees', label: 'Вработени и улоги' },
  { path: '/admin/permissions', label: 'Улоги и дозволи' },
  { path: '/admin/calendars', label: 'Календари' },
  { path: '/admin/automations', label: 'Автоматизации' },
  { path: '/admin/alarms', label: 'Аларми' },
];

export function AdminLayout() {
  const loc = useLocation();
  const active = SECTIONS.find((s) => loc.pathname.startsWith(s.path)) ?? SECTIONS[0];

  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <aside style={sidebar}>
        <div style={consoleLabel}>АДМИН КОНЗОЛА</div>
        {SECTIONS.map((s) => (
          <NavLink key={s.path} to={s.path} style={sectionLink}>
            {s.label}
          </NavLink>
        ))}
      </aside>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* 56px секција-заглавие (Handoff §Админ) */}
        <header style={sectionHeader}>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{active?.label}</h1>
        </header>
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 20px' }}>
          <Outlet />
        </div>
      </div>
    </div>
  );
}

const sidebar: React.CSSProperties = {
  width: 240,
  flex: '0 0 240px',
  borderRight: '1px solid var(--gd-border)',
  background: 'var(--gd-surface)',
  padding: 12,
};
const consoleLabel: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--gd-ink-muted)',
  padding: '4px 8px 8px',
};
const sectionHeader: React.CSSProperties = {
  height: 56,
  flex: '0 0 56px',
  borderBottom: '1px solid var(--gd-border)',
  background: 'var(--gd-surface)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 20px',
};

const sectionLink = ({ isActive }: { isActive: boolean }): React.CSSProperties => ({
  display: 'block',
  padding: '8px 10px',
  borderRadius: 6,
  fontSize: 14,
  textDecoration: 'none',
  color: isActive ? 'var(--gd-primary-hover)' : 'var(--gd-ink)',
  background: isActive ? 'var(--gd-primary-tint)' : 'transparent',
  fontWeight: isActive ? 600 : 400,
});
