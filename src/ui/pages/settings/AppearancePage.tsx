import settingsZh from '../../../i18n/features/settings/zh.json';
import settingsEn from '../../../i18n/features/settings/en.json';
import { getAvailableThemes } from '../../../themes/registry';
import { isFeatureEnabled, subscribeFeatureFlags } from '../../../application/feature-flags';
import { Button, Chip } from '../../components/common';
import { useMainline } from '../../mainline/context';
import { useState, useSyncExternalStore } from 'react';
export function AppearancePage() {
 const { t, locale, appearance, navigate } = useMainline();
 const copy = locale === 'zh' ? settingsZh : settingsEn;
 const [more, setMore] = useState(false);
 const discovery = useSyncExternalStore(subscribeFeatureFlags, () => isFeatureEnabled('themeDiscovery'), () => false);
 const available = getAvailableThemes(discovery);
 const builtinIds = new Set(getAvailableThemes(false).map(theme => theme.id));
 const extra = available.filter(theme => !builtinIds.has(theme.id));
 const choice = (theme: typeof available[number]) => <Chip key={theme.id} aria-label={theme.name[locale]} selected={theme.id === appearance.theme} onClick={() => appearance.change(theme.id)}>{theme.name[locale]}</Chip>;
 return <main><h1>{t.appearance}</h1><div className="v8-capsules">{available.map(choice)}</div>
  <Button aria-expanded={more} onClick={() => setMore(!more)}>{copy.appearancePage0}</Button>
  {more && <section aria-label={copy.appearancePage0}>{extra.length ? <div className="v8-capsules">{extra.map(choice)}</div> : <p role="status">{copy.appearancePage1}</p>}</section>}
  <Button onClick={() => navigate('/settings')}>{t.back}</Button></main>;
}
