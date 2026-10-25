import settingsZh from '../../../i18n/features/settings/zh.json';
import settingsEn from '../../../i18n/features/settings/en.json';
import { getAvailableThemes } from '../../../themes/registry';
import { isFeatureEnabled, subscribeFeatureFlags } from '../../../application/feature-flags';
import { Button } from '../../components/common';
import { ThemePicker } from '../../components/ThemePicker';
import { SegmentedTabs } from '../../components/kit';
import { themeEntryCopy } from '../../../i18n/features/home/theme';
import './appearance.css';
import { useMainline } from '../../mainline/context';
import { useState, useSyncExternalStore } from 'react';
export function AppearancePage() {
  const { t, locale, appearance, navigate } = useMainline();
  const copy = locale === 'zh' ? settingsZh : settingsEn,
    entry = themeEntryCopy[locale];
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
      <section className="v8-appearance" aria-label={entry.textSize}>
        <h2>{entry.textSize}</h2>
        <SegmentedTabs
          label={entry.textSize}
          options={[
            { value: 'standard', label: entry.textStandard },
            { value: 'large', label: entry.textLarge },
          ]}
          value={appearance.textSize}
          onChange={value => appearance.changeTextSize(value === 'large' ? 'large' : 'standard')}
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
