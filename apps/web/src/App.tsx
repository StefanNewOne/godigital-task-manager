import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
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
import { AdminAutomations } from './screens/admin/Automations.js';
import { AdminClients } from './screens/admin/Clients.js';
import { AdminEmployees } from './screens/admin/Employees.js';
import { AdminPermissions } from './screens/admin/RolesPermissions.js';

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
          <Route index element={<Overview />} />
          <Route path="tasks" element={<TasksScreen />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="clients" element={<Clients />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="/admin/clients" replace />} />
            <Route path="clients" element={<AdminClients />} />
            <Route path="employees" element={<AdminEmployees />} />
            <Route path="permissions" element={<AdminPermissions />} />
            <Route path="automations" element={<AdminAutomations />} />
          </Route>
          <Route path="*" element={<Placeholder title="Ненајдена страница" />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
