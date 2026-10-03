import { useEffect, useRef, useState, type ReactElement } from 'react';
import { flushSync } from 'react-dom';
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
import { restoreChannelName, restoreStorageKey, restoreEventName } from '../application/backup';
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
  const [libraryGeneration, setLibraryGeneration] = useState(0);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const restoringRef = useRef(false);
  useEffect(() => {
    let generation: number | undefined;
    async function reloadImportedLibrary() {
      if (restoringRef.current) return;
      restoringRef.current = true;
      flushSync(() => { setRestoring(true); setRestoreError(''); });
      try {
        const metadata = await repository.readMetadata();
        const profile = await database.profiles.toCollection().first();
        generation = metadata.restoreGeneration ?? 0;
        repository.adoptGeneration(generation);
        if (profile) {
          try { localStorage.setItem(languageKey, profile.locale); }
          catch { /* The imported profile still provides the authoritative language. */ }
          await i18n.changeLanguage(profile.locale);
        }
        setLibraryGeneration(value => value + 1);
        setRestoring(false);
      } catch (reason) {
        setRestoreError(String(reason));
      } finally {
        restoringRef.current = false;
      }
    }
    const subscription = liveQuery(async () => {
      const metadata = await database.metadata.toCollection().first();
      if (metadata) await repository.readMetadata();
      return metadata?.restoreGeneration ?? (metadata ? 0 : undefined);
    }).subscribe({ next: value => {
      if (value === undefined) return;
      if (generation !== undefined && generation !== value) void reloadImportedLibrary();
      generation ??= value;
    }, error: () => {
      // Each page renders startup persistence failures, including aborted upgrades.
    } });
    function onRestored(event: Event) {
      if ((event as CustomEvent<{ databaseName: string }>).detail?.databaseName === database.name) void reloadImportedLibrary();
    }
    window.addEventListener(restoreEventName, onRestored);
    const channel = typeof BroadcastChannel === 'undefined' ? undefined : new BroadcastChannel(restoreChannelName);
    if (channel) channel.onmessage = event => {
      if (event.data?.databaseName === database.name) void checkStoredGeneration().catch(() => { /* Persistence feedback remains visible. */ });
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
      window.removeEventListener(restoreEventName, onRestored);
    };
  }, []);
  useEffect(() => {
    const synchronize = () => { if (!restoringRef.current) void profileService.setLocale(i18n.resolvedLanguage === 'zh' ? 'zh' : 'en').catch(() => { /* Settings reports unavailable persistence; navigation remains usable. */ }); };
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
          <select disabled={restoring} value={i18n.resolvedLanguage ?? 'en'} onChange={(event) => void i18n.changeLanguage(event.target.value)}>
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
        {restoreError && <p role="alert">{restoreError}</p>}
        {restoring ? <p role="status">{i18n.resolvedLanguage === 'zh' ? '正在读取恢复后的本地数据…' : 'Reading restored local data…'}</p> : <Routes key={libraryGeneration}>
          {destinations.map(([name, path]) => (
            <Route key={name} path={path} element={name === 'today' ? <TodayPage /> : name === 'exercises' ? <CatalogPage /> : name === 'settings' ? <SettingsPage /> : name === 'plans' ? <PlansPage /> : <ProgressPage />} />
          ))}
          <Route path="/workout" element={<WorkoutPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>}
      </main>
      <footer>{t('local')}</footer>
    </div>
  );
}
