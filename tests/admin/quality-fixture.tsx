import React from 'react';
import { createRoot } from 'react-dom/client';
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { AdminErrorsPage, AdminNotificationSettings, AdminQualityPage } from '../../src/ui/admin/quality/pages';
import { ApplicationsPage, UsersPage } from '../../src/ui/admin/users/UsersPages';
import { adminWorkspaceTokens } from '../../src/ui/admin/tokens';
import '../../src/ui/admin/shell/admin-shell.css';
const language = new URLSearchParams(location.search).get('language') ?? 'zh';
void i18n
  .use(initReactI18next)
  .init({ lng: language, resources: { zh: { translation: {} }, en: { translation: {} } } })
  .then(() => {
    const view = new URLSearchParams(location.search).get('view');
    createRoot(document.getElementById('root')!).render(
      <div className="admin-workspace" style={adminWorkspaceTokens}>
        <main>
          {view === 'applications' ? (
            <ApplicationsPage language={language} />
          ) : view === 'users' ? (
            <UsersPage language={language} />
          ) : view === 'errors' ? (
            <AdminErrorsPage />
          ) : view === 'reports' ? (
            <AdminQualityPage />
          ) : (
            <AdminNotificationSettings />
          )}
        </main>
      </div>,
    );
  });
