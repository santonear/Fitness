import { StrictMode, Suspense, lazy } from 'react';
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

const MainlineApp = lazy(() => import('./ui/mainline/MainlineApp'));
createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter>{location.pathname === '/admin' || location.pathname.startsWith('/admin/') ? <ManagementPage /> : import.meta.env.VITE_FITNESS_V8 === '1' ? <Suspense fallback={null}><MainlineApp /></Suspense> : <AppearanceProvider><App /></AppearanceProvider>}</BrowserRouter></StrictMode>);

import './ui/icons-v5.css';
