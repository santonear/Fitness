import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import './i18n';
import { App } from './ui/App';
import './ui/styles.css';
import './ui/guided-theme.css';
import './ui/analytics-theme.css';
import './ui/onboarding-theme.css';
import './ui/ui-ux-max-theme.css';

createRoot(document.getElementById('root')!).render(<StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>);
