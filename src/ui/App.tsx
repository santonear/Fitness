import { AppIcon, StatusIcon } from './components/AppIcon';
import { useEffect, useRef, useState, type ReactElement } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { CatalogPage } from './pages/CatalogPage';
import { SettingsPage } from './pages/SettingsPage';
import { WorkoutPage } from './pages/WorkoutPage';
import { ProgressPage } from './pages/ProgressPage';
import { FloatingCoach, CoachRoute } from './components/FloatingCoach';
import { TrialAccess } from './components/TrialAccess';
import { profileService } from '../application/profile';
import { liveQuery } from 'dexie';
import { database } from '../persistence/db';
import { repository } from '../persistence/repository';
import { restoreChannelName, restoreStorageKey, restoreEventName } from '../application/backup';
import { languageKey } from '../i18n';
import { NavigationIcon } from './components/NavigationIcon';
import { useAppearance } from './components/Appearance';
import { TodayPage } from './pages/TodayPage';
import { PlansWorkspace } from './pages/PlansWorkspace';
import { OnboardingV4Page } from './pages/OnboardingV4Page';
import { OnboardingGate } from './components/OnboardingGate';

const destinations = [
  ['today', '/'],
  ['plans', '/plans'],
  ['progress', '/progress'],
  ['exercises', '/exercises'],
  ['settings', '/settings'],
] as const;

export function App(): ReactElement {
  const { t, i18n } = useTranslation();
  const { theme, change } = useAppearance();
  const zh = i18n.resolvedLanguage === 'zh';
  const location = useLocation();
  const sectionPath = location.pathname === '/ai' ? '/plans' : location.pathname === '/trial' ? '/settings' : location.pathname === '/workout' ? '/' : location.pathname;
  const previousPath = useRef(location.pathname);
  const main = useRef<HTMLElement>(null);
  const [libraryGeneration, setLibraryGeneration] = useState(0);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState('');
  const [restoreSucceeded, setRestoreSucceeded] = useState(false);
  const restoringRef = useRef(false);
  useEffect(() => {
    let generation: number | undefined;
    async function reloadImportedLibrary() {
      if (restoringRef.current) return;
      restoringRef.current = true;
      flushSync(() => { setRestoring(true); setRestoreError(''); setRestoreSucceeded(false); });
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
        setRestoreSucceeded(true);
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
      setNavigationOpen(false);
      main.current?.focus();
      window.scrollTo({top:0,behavior:'instant'});
      setRestoreSucceeded(false);
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);

  return (
    <div className={`app-shell fitness-workspace v31-shell theme-${theme}${navigationOpen ? ' navigation-open' : ''}${location.pathname === '/onboarding' ? ' onboarding-immersive' : ''}`}>
      <a className="skip-link" href="#content">{t('skip')}</a>
      <aside className="app-sidebar" id="workspace-navigation">
        <div className="app-brand"><span className="app-brand-mark" aria-hidden="true">f·</span><span className="brand">{t('brand')}<span aria-hidden="true">.</span></span></div>
        <p className="app-sidebar-label">{zh ? '本地训练 + 可选 AI 助手' : 'Local training + optional AI'}</p>
        <nav aria-label={t('navigation')}>
          {destinations.map(([name, path]) => (
            <NavLink key={name} to={path} end tabIndex={0} className={sectionPath === path ? 'active' : undefined} aria-current={sectionPath === path ? 'page' : undefined}>
              <NavigationIcon name={name} />
              <span><strong>{t(name)}</strong><small>{(zh ? { today: '今天、接下来与开始训练', plans: '日历、安排与创建计划', progress: '趋势、负荷与身体记录', exercises: '查找动作、器械与说明', settings: '外观、资格、备份与资料' } : { today: 'Today, next up & workouts', plans: 'Calendar, schedule & create', progress: 'Trends, load & measurements', exercises: 'Movement, equipment & guidance', settings: 'Appearance, trial & backup' })[name]}</small></span>
            </NavLink>
          ))}
        </nav>
        <label className="v31-sidebar-appearance">{zh ? '切换版式' : 'Switch layout'}<select aria-label={zh ? '侧栏版式' : 'Sidebar layout'} value={theme} onChange={event=>change(event.target.value as typeof theme)}><option value="atlas">Atlas</option><option value="serene">Serene</option><option value="orbit">Orbit</option></select></label>
        <div className="app-sidebar-note">
          <p>{i18n.resolvedLanguage === 'zh' ? '你的训练，你的空间。' : 'Your training. Your space.'}</p>
          <p>{i18n.resolvedLanguage === 'zh' ? '无需账号。记录保存在此浏览器，请定期备份。' : 'No account needed. Records stay in this browser. Keep regular backups.'}</p>
        </div>
      </aside>
      <header className="app-header">
        <button className="workspace-menu" aria-controls="workspace-navigation" aria-expanded={navigationOpen} onClick={() => setNavigationOpen(value => !value)}><AppIcon name="menu"/>{i18n.resolvedLanguage === 'zh' ? '导航' : 'menu'}</button>
        <p className="app-breadcrumb"><span>{i18n.resolvedLanguage === 'zh' ? '训练空间' : 'Workspace'}</span><span aria-hidden="true">/</span>{location.pathname === '/onboarding' ? (zh ? '新手引导' : 'Onboarding') : location.pathname === '/workout' ? t('today') : location.pathname === '/ai' ? t('plans') : location.pathname === '/trial' ? t('settings') : t(destinations.find(([, path]) => path === location.pathname)?.[0] ?? 'today')}</p>
        <label className="v31-quick-theme"><span>{zh ? '版式' : 'Layout'}</span><select aria-label={zh ? '切换版式' : 'Switch layout'} value={theme} onChange={event => change(event.target.value as typeof theme)}><option value="atlas">Atlas</option><option value="serene">Serene</option><option value="orbit">Orbit</option></select></label>
        <label className="language-control">
          <span>{t('language')}</span>
          <select aria-label={t('language')} disabled={restoring} value={i18n.resolvedLanguage ?? 'en'} onChange={(event) => void i18n.changeLanguage(event.target.value)}>
            <option value="en" lang="en">English</option>
            <option value="zh" lang="zh">中文</option>
          </select>
        </label>
      </header>
      <main id="content" ref={main} tabIndex={-1}>
        {restoreError && <p role="alert"><StatusIcon status="warning"/>{restoreError}</p>}
        {restoreSucceeded && <p data-testid="restore-result" aria-live="polite">{i18n.resolvedLanguage === 'zh' ? '恢复成功。' : 'Restore succeeded.'}</p>}
        {restoring ? <p role="status"><AppIcon name="info"/>{i18n.resolvedLanguage === 'zh' ? '正在读取恢复后的本地数据…' : 'Reading restored local data…'}</p> : <OnboardingGate key={libraryGeneration}><Routes>
          {destinations.map(([name, path]) => (
            <Route key={name} path={path} element={name === 'today' ? <TodayPage /> : name === 'exercises' ? <CatalogPage /> : name === 'settings' ? <SettingsPage restored={restoreSucceeded} /> : name === 'plans' ? <PlansWorkspace /> : <ProgressPage />} />
          ))}
          <Route path="/workout" element={<WorkoutPage />} />
          <Route path="/ai" element={<CoachRoute />} />
          <Route path="/trial" element={<TrialAccess />} />
          <Route path="/onboarding" element={<OnboardingV4Page />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes></OnboardingGate>}
      </main>
      <aside className="v31-context"><h2>{zh ? '你的训练空间' : 'Your training space'}</h2><p>{zh ? '每一次完成都独立记录。按自己的节奏安排训练，也给恢复留出空间。' : 'Each workout is recorded independently. Make room for training and recovery at your own pace.'}</p><NavLink to="/plans">{zh ? '查看训练安排' : 'View your schedule'}</NavLink><hr /><h3>{zh ? 'AI 是可选工具' : 'AI is optional'}</h3><p>{zh ? '即使资格过期或网络不可用，已加载应用中的本地训练记录、动作库与备份仍可使用。' : 'When trial access expires or the network is unavailable, local workouts, exercises and backups stay usable in the loaded app.'}</p><NavLink to="/trial">{zh ? '查看 AI 资格与额度' : 'View AI access & quota'}</NavLink><hr /><p>{t('local')}</p></aside>
      <nav className="v31-mobile-nav" aria-label={zh ? '底部导航' : 'Bottom navigation'}>{destinations.map(([name,path]) => <NavLink key={name} to={path} end tabIndex={0} className={sectionPath === path ? 'active' : undefined} aria-current={sectionPath === path ? 'page' : undefined}><NavigationIcon name={name} /><span>{t(name)}</span></NavLink>)}</nav>
      {!restoring && <FloatingCoach key={libraryGeneration} />}
      <footer>{t('local')}</footer>
    </div>
  );
}
