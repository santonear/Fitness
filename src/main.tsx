import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './i18n';
import { App } from './ui/App';
import { ManagementPage } from './ui/pages/ManagementPage';
import './ui/styles.css';
import './ui/trial-access.css';
import './ui/v31.css';
import './ui/v31-plans.css';
import './ui/v31-progress-catalog.css';
import './ui/v31-ai.css';
import './ui/onboarding-v4.css';
import { AppearanceProvider } from './ui/components/Appearance';

createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter>{location.pathname === '/admin' || location.pathname.startsWith('/admin/') ? <ManagementPage /> : <AppearanceProvider><App /></AppearanceProvider>}</BrowserRouter></StrictMode>);

import './ui/icons-v5.css';
