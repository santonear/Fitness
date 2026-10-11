import React from 'react';
import { createRoot } from 'react-dom/client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { AdminErrorsPage, AdminNotificationSettings, AdminQualityPage } from '../../src/ui/admin/quality/pages';
import '../../src/ui/admin/shell/tokens.css';
import '../../src/ui/admin/shell/admin-shell.css';
void i18n.use(initReactI18next).init({ lng: 'zh', resources: { zh: { translation: {} } } }).then(() => {
  const view = new URLSearchParams(location.search).get('view');
  createRoot(document.getElementById('root')!).render(<div className="admin-workspace"><main>{view === 'errors' ? <AdminErrorsPage/> : view === 'reports' ? <AdminQualityPage/> : <AdminNotificationSettings/>}</main></div>);
});
