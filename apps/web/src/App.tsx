import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PERMISSIONS, type Role, type Screen } from '@gd/core';
import { useMe } from './api/auth.js';
import { AppShell } from './components/AppShell.js';
import { Analytics } from './screens/Analytics.js';
import { Calendar } from './screens/Calendar.js';
import { Clients } from './screens/Clients.js';
import { Login } from './screens/Login.js';
import { Overview } from './screens/Overview.js';
import { Placeholder } from './screens/Placeholder.js';
import { TasksScreen } from './screens/tasks/TasksScreen.js';
import { AdminLayout } from './screens/admin/AdminLayout.js';
import { AdminAlarms } from './screens/admin/Alarms.js';
import { AdminAutomations } from './screens/admin/Automations.js';
import { AdminCalendars } from './screens/admin/Calendars.js';
import { AdminClients } from './screens/admin/Clients.js';
import { AdminEmployees } from './screens/admin/Employees.js';
import { AdminPermissions } from './screens/admin/RolesPermissions.js';

/** Екран → рута (за пренасочување кон дозволен екран). */
const SCREEN_PATH: Record<Screen, string> = {
  director: '/',
  list: '/tasks',
  calendar: '/calendar',
  clients: '/clients',
  analytics: '/analytics',
  admin: '/admin',
};

/** Почетна рута по улога = првиот екран во `nav` (Директор → Преглед, друг → неговиот прв екран). */
function homePath(role: Role): string {
  const first = PERMISSIONS[role].nav[0];
  return first ? SCREEN_PATH[first] : '/tasks';
}

/**
 * Ролна порта на ниво на рута (И4): ако улогата го нема екранот во `nav`, пренасочи кон нејзиниот
 * почетен екран. Скривањето на иконата не е доволно — рутата мора да одбие пристап по URL.
 */
function Guard({
  screen,
  role,
  children,
}: {
  screen: Screen;
  role: Role;
  children: ReactElement;
}): ReactElement {
  if (!PERMISSIONS[role].nav.includes(screen)) return <Navigate to={homePath(role)} replace />;
  return children;
}

export function App() {
  const { data: me, isLoading, isError } = useMe();

  if (isLoading) {
    return <div style={{ padding: 24, color: 'var(--gd-ink-muted)' }}>Вчитување…</div>;
  }
  if (isError || !me) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route
            index
            element={
              <Guard screen="director" role={me.role}>
                <Overview />
              </Guard>
            }
          />
          <Route
            path="tasks"
            element={
              <Guard screen="list" role={me.role}>
                <TasksScreen />
              </Guard>
            }
          />
          <Route
            path="calendar"
            element={
              <Guard screen="calendar" role={me.role}>
                <Calendar />
              </Guard>
            }
          />
          <Route
            path="clients"
            element={
              <Guard screen="clients" role={me.role}>
                <Clients />
              </Guard>
            }
          />
          <Route
            path="analytics"
            element={
              <Guard screen="analytics" role={me.role}>
                <Analytics />
              </Guard>
            }
          />
          <Route
            path="admin"
            element={
              <Guard screen="admin" role={me.role}>
                <AdminLayout />
              </Guard>
            }
          >
            <Route index element={<Navigate to="/admin/clients" replace />} />
            <Route path="clients" element={<AdminClients />} />
            <Route path="employees" element={<AdminEmployees />} />
            <Route path="permissions" element={<AdminPermissions />} />
            <Route path="calendars" element={<AdminCalendars />} />
            <Route path="automations" element={<AdminAutomations />} />
            <Route path="alarms" element={<AdminAlarms />} />
          </Route>
          <Route path="*" element={<Placeholder title="Ненајдена страница" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
