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
      <aside className="app-sidebar">
        <div className="app-brand"><span className="app-brand-mark" aria-hidden="true">f·</span><span className="brand">{t('brand')}<span aria-hidden="true">.</span></span></div>
        <p className="app-sidebar-label">{i18n.resolvedLanguage === 'zh' ? '个人训练空间' : 'YOUR WORKSPACE'}</p>
        <nav aria-label={t('navigation')}>
          {destinations.map(([name, path], index) => (
            <NavLink key={name} to={path} end tabIndex={0}>
              <span className="app-nav-icon" aria-hidden="true" data-icon={['◫', '▤', '◇', '↗', '⚙'][index]} />
              <span>{t(name)}</span>
            </NavLink>
          ))}
        </nav>
        <div className="app-sidebar-note">
          <p>{i18n.resolvedLanguage === 'zh' ? '你的训练，你的空间。' : 'Your training. Your space.'}</p>
          <p>{i18n.resolvedLanguage === 'zh' ? '无需账号。记录保存在此浏览器，请定期备份。' : 'No account needed. Records stay in this browser. Keep regular backups.'}</p>
        </div>
      </aside>
      <header className="app-header">
        <p className="app-breadcrumb"><span>{i18n.resolvedLanguage === 'zh' ? '训练空间' : 'Workspace'}</span><span aria-hidden="true">/</span>{location.pathname === '/workout' ? (i18n.resolvedLanguage === 'zh' ? '今日训练' : 'Today') : t(destinations.find(([, path]) => path === location.pathname)?.[0] ?? 'today')}</p>
        <label className="language-control">
          <span>{t('language')}</span>
          <select aria-label={t('language')} disabled={restoring} value={i18n.resolvedLanguage ?? 'en'} onChange={(event) => void i18n.changeLanguage(event.target.value)}>
            <option value="en" lang="en">English</option>
            <option value="zh" lang="zh">中文</option>
          </select>
        </label>
      </header>
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
