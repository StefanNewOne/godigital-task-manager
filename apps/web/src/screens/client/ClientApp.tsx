import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ClientLanding } from './ClientLanding.js';
import { ClientApprovals } from './ClientApprovals.js';
import { ClientApprovalDetail } from './ClientApprovalDetail.js';

/**
 * Клиентски PWA (Фаза D) — целосно одделен realm од вработените (без employee nav/`useMe`).
 * Се рендерира од `App` само кога патеката е под `/client`.
 */
export function ClientApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/client" element={<ClientLanding />} />
        <Route path="/client/approvals" element={<ClientApprovals />} />
        <Route path="/client/approvals/:id" element={<ClientApprovalDetail />} />
        <Route path="*" element={<Navigate to="/client" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
