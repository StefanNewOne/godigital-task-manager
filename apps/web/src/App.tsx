import type { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { PERMISSIONS, type Role, type Screen } from '@gd/core';
import { t } from '@gd/ui';
import { useMe } from './api/auth.js';
import { AppShell } from './components/AppShell.js';
import { Analytics } from './screens/Analytics.js';
import { Calendar } from './screens/Calendar.js';
import { ShootCalendar } from './screens/ShootCalendar.js';
import { Clients } from './screens/Clients.js';
import { Login } from './screens/Login.js';
import { ForgotPassword } from './screens/ForgotPassword.js';
import { ResetPassword } from './screens/ResetPassword.js';
import { Overview } from './screens/Overview.js';
import { Placeholder } from './screens/Placeholder.js';
import { Settings } from './screens/Settings.js';
import { TasksScreen } from './screens/tasks/TasksScreen.js';
import { CrmScreen } from './screens/crm/CrmScreen.js';
import { MetaScreen } from './screens/meta/MetaScreen.js';
import { AdminLayout } from './screens/admin/AdminLayout.js';
import { AdminAlarms } from './screens/admin/Alarms.js';
import { AdminAutomations } from './screens/admin/Automations.js';
import { AdminCalendars } from './screens/admin/Calendars.js';
import { AdminClients } from './screens/admin/Clients.js';
import { AdminEmployees } from './screens/admin/Employees.js';
import { AdminPermissions } from './screens/admin/RolesPermissions.js';
import { ClientApp } from './screens/client/ClientApp.js';

/** Екран → рута (за пренасочување кон дозволен екран). */
const SCREEN_PATH: Record<Screen, string> = {
  director: '/',
  list: '/tasks',
  calendar: '/calendar',
  shootCalendar: '/shoot-calendar',
  clients: '/clients',
  analytics: '/analytics',
  admin: '/admin',
  crm: '/crm',
  meta: '/meta',
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
  // Клиентскиот PWA (Фаза D) е целосно одделен realm — се одбира пред employee `useMe`,
  // за да не се повикува /me ниту employee auth за клиентски посетители.
  // ВАЖНО: точно `/client` или под `/client/` — да НЕ го фати employee `/clients` екранот.
  const path = typeof window !== 'undefined' ? window.location.pathname : '';
  if (path === '/client' || path.startsWith('/client/')) {
    return <ClientApp />;
  }
  return <EmployeeApp />;
}

function EmployeeApp() {
  const { data: me, isLoading, isError } = useMe();

  if (isLoading) {
    return <div style={{ padding: 24, color: 'var(--gd-ink-muted)' }}>{t('errors.loading')}</div>;
  }
  if (isError || !me) {
    // Најавата + јавните auth екрани (заборавена/нова лозинка, H4) живеат во свој router.
    return (
      <BrowserRouter>
        <Routes>
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="*" element={<Login />} />
        </Routes>
      </BrowserRouter>
    );
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
            path="shoot-calendar"
            element={
              <Guard screen="shootCalendar" role={me.role}>
                <ShootCalendar />
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
          {/* Модул 2 · Продажен CRM (Продажба). */}
          <Route
            path="crm"
            element={
              <Guard screen="crm" role={me.role}>
                <CrmScreen />
              </Guard>
            }
          />
          {/* Модул 3 · Мета — read екрани (М2). Инбокс/Планови/Асистент во М4+. */}
          <Route
            path="meta"
            element={
              <Guard screen="meta" role={me.role}>
                <MetaScreen />
              </Guard>
            }
          />
          {/* Лични поставки (H6) — не се врзани за nav дозволи; достапни за секоја улога. */}
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<Placeholder title={t('errors.notFound')} />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
