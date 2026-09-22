import type React from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const SECTIONS = [
  { path: '/admin/clients', label: 'Клиенти' },
  { path: '/admin/employees', label: 'Вработени и улоги' },
  { path: '/admin/permissions', label: 'Улоги и дозволи' },
];

export function AdminLayout() {
  return (
    <div style={{ display: 'flex', height: '100%' }}>
      <aside
        style={{
          width: 240,
          borderRight: '1px solid var(--gd-border)',
          background: 'var(--gd-surface)',
          padding: 12,
        }}
      >
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--gd-ink-muted)',
            padding: '4px 8px 8px',
          }}
        >
          АДМИН КОНЗОЛА
        </div>
        {SECTIONS.map((s) => (
          <NavLink key={s.path} to={s.path} style={sectionLink}>
            {s.label}
          </NavLink>
        ))}
      </aside>
      <div style={{ flex: 1, overflow: 'auto', padding: '24px 20px' }}>
        <Outlet />
      </div>
    </div>
  );
}

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
