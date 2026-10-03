import { useEffect, useRef, type ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CatalogPage } from './pages/CatalogPage';
import { SettingsPage } from './pages/SettingsPage';
import { PlansPage } from './pages/PlansPage';
import { WorkoutPage } from './pages/WorkoutPage';
import { TodayPage } from './pages/TodayPage';
import { ProgressPage } from './pages/ProgressPage';
import { profileService } from '../application/profile';
import { liveQuery } from 'dexie';
import { database } from '../persistence/db';
import { repository } from '../persistence/repository';
import { restoreChannelName, restoreStorageKey } from '../application/backup';
import { languageKey } from '../i18n';

const destinations = [
  ['today', '/'],
  ['plans', '/plans'],
  ['exercises', '/exercises'],
  ['progress', '/progress'],
  ['settings', '/settings'],
] as const;

export function App(): ReactElement {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const previousPath = useRef(location.pathname);
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    let generation: number | undefined;
    let reloading = false;
    async function reloadImportedLibrary() {
      if (reloading) return;
      reloading = true;
      const profile = await database.profiles.toCollection().first();
      if (profile) {
        try { localStorage.setItem(languageKey, profile.locale); }
        catch { /* Reload still clears stale forms if localStorage is unavailable. */ }
      }
      window.location.reload();
    }
    const subscription = liveQuery(async () => {
      const metadata = await database.metadata.toCollection().first();
      if (metadata) await repository.readMetadata();
      return metadata?.restoreGeneration ?? (metadata ? 0 : undefined);
    }).subscribe(value => {
      if (value === undefined) return;
      if (generation !== undefined && generation !== value) void reloadImportedLibrary();
      generation ??= value;
    });
    const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(restoreChannelName);
    if (channel) channel.onmessage = event => {
      if (event.data?.databaseName === database.name) void reloadImportedLibrary();
    };
    async function checkStoredGeneration() {
      const metadata = await repository.readMetadata();
      const current = metadata.restoreGeneration ?? 0;
      if (generation !== undefined && current !== generation) await reloadImportedLibrary();
    }
    function onStorage(event: StorageEvent) {
      if (event.key === restoreStorageKey(database.name)) {
        void checkStoredGeneration().catch(() => { /* Normal persistence UI reports unavailable data. */ });
      }
    }
    window.addEventListener('storage', onStorage);
    return () => {
      subscription.unsubscribe();
      channel?.close();
      window.removeEventListener('storage', onStorage);
    };
  }, []);
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
            <Route key={name} path={path} element={name === 'today' ? <TodayPage /> : name === 'exercises' ? <CatalogPage /> : name === 'settings' ? <SettingsPage /> : name === 'plans' ? <PlansPage /> : <ProgressPage />} />
          ))}
          <Route path="/workout" element={<WorkoutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <footer>{t('local')}</footer>
    </div>
  );
}
