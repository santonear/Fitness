import settingsZh from '../../../i18n/features/settings/zh.json';
import settingsEn from '../../../i18n/features/settings/en.json';
import { getAvailableThemes } from '../../../themes/registry';
import { isFeatureEnabled, subscribeFeatureFlags } from '../../../application/feature-flags';
import { Button } from '../../components/common';
import { ThemePicker } from '../../components/ThemePicker';
import './appearance.css';
import { useMainline } from '../../mainline/context';
import { useState, useSyncExternalStore } from 'react';
export function AppearancePage() {
  const { t, locale, appearance, navigate } = useMainline();
  const copy = locale === 'zh' ? settingsZh : settingsEn;
  const [more, setMore] = useState(false);
  const discovery = useSyncExternalStore(
    subscribeFeatureFlags,
    () => isFeatureEnabled('themeDiscovery'),
    () => false,
  );
  const available = getAvailableThemes(discovery);
  const builtinIds = new Set(getAvailableThemes(false).map(theme => theme.id));
  const extra = available.filter(theme => !builtinIds.has(theme.id));
  return (
    <main>
      <h1>{t.appearance}</h1>
      <section className="v8-appearance" aria-label={copy.appearanceStyle}>
        <h2>{copy.appearanceStyle}</h2>
        <ThemePicker
          themes={available.filter(theme => builtinIds.has(theme.id))}
          value={appearance.theme}
          onChange={appearance.change}
          locale={locale}
          label={copy.appearanceStyle}
        />
      </section>
      <Button aria-expanded={more} onClick={() => setMore(!more)}>
        {copy.appearancePage0}
      </Button>
      {more && (
        <section aria-label={copy.appearancePage0}>
          {extra.length ? (
            <ThemePicker
              themes={extra}
              value={appearance.theme}
              onChange={appearance.change}
              locale={locale}
              label={copy.appearancePage0}
            />
          ) : (
            <p role="status">{copy.appearancePage1}</p>
          )}
        </section>
      )}
      <Button onClick={() => navigate('/settings')}>{t.back}</Button>
    </main>
  );
}
