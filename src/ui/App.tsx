import { useEffect, useRef, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CatalogPage } from './pages/CatalogPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlansPage } from './pages/PlansPage';
import { profileService } from '../application/profile';

const destinations = [
  ['today', '/'],
  ['plans', '/plans'],
  ['exercises', '/exercises'],
  ['progress', '/progress'],
  ['settings', '/settings'],
] as const;
type Destination = typeof destinations[number][0];

function EmptyPage({ destination }: { destination: Destination }): ReactElement {
  const { t } = useTranslation();
  return (
    <>
      <h1>{t(destination)}</h1>
      <section className="empty-state" aria-label={t(destination)}>
        <p className="empty-title">{t(`${destination}Empty`)}</p>
        <p className="muted">{t('pending')}</p>
      </section>
    </>
  );
}

export function App(): ReactElement {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    const synchronize = () => { void profileService.setLocale(i18n.resolvedLanguage === 'zh' ? 'zh' : 'en').catch(() => { /* Settings reports unavailable persistence; navigation remains usable. */ }); };
    synchronize();
    i18n.on('languageChanged', synchronize);
    return () => { i18n.off('languageChanged', synchronize); };
  }, [i18n]);
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      main.current?.focus();
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);

  return (
    <div className="app-shell">
      <a className="skip-link" href="#content">{t('skip')}</a>
      <header className="app-header">
        <span className="brand">{t('brand')}</span>
        <label className="language-control">
          {t('language')}
          <select value={i18n.resolvedLanguage ?? 'en'} onChange={(event) => void i18n.changeLanguage(event.target.value)}>
            <option value="en" lang="en">English</option>
            <option value="zh" lang="zh">中文</option>
          </select>
        </label>
      </header>
      <nav aria-label={t('navigation')}>
        {destinations.map(([name, path]) => (
          <NavLink key={name} to={path} end tabIndex={0}>{t(name)}</NavLink>
        ))}
      </nav>
      <main id="content" ref={main} tabIndex={-1}>
        <Routes>
          {destinations.map(([name, path]) => (
            <Route key={name} path={path} element={name === 'exercises' ? <CatalogPage /> : name === 'settings' ? <SettingsPage /> : name === 'plans' ? <PlansPage /> : <EmptyPage destination={name} />} />
          ))}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer>{t('local')}</footer>
    </div>
  );
}
