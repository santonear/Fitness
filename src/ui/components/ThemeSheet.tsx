import { useRef, useState, useSyncExternalStore } from 'react';
import { getAvailableThemes } from '../../themes/registry';
import { isFeatureEnabled, subscribeFeatureFlags } from '../../application/feature-flags';
import { useOptionalTheme } from '../../themes/ThemeProvider';
import { themeEntryCopy } from '../../i18n/features/home/theme';
import { MorphPanel } from './common';
import { PrimaryButton, SegmentedTabs } from './kit';
import { ThemePicker } from './ThemePicker';
import './theme-sheet.css';

/** Built-in V9 themes; switching applies at once (same store as 我的 › 界面风格). */
export function useThemeChoices() {
  const discovery = useSyncExternalStore(subscribeFeatureFlags, () => isFeatureEnabled('themeDiscovery'), () => false);
  const builtin = new Set(getAvailableThemes(false).map(theme => theme.id));
  return getAvailableThemes(discovery).filter(theme => builtin.has(theme.id));
}

/** Small, always-visible 换风格 button that opens the theme picker with live previews in a sheet. */
export interface LanguageChoice { onChange: (next: 'zh' | 'en') => void; busy?: boolean }
/** Language lives here too, so it is reachable from 今天 and the welcome page (Bo 2026-10-19). */
export function ThemeButton({ locale, label, language }: { locale: 'zh' | 'en'; /** Visible text; defaults to 换风格. */ label?: string; language?: LanguageChoice }) {
  const t = themeEntryCopy[locale], appearance = useOptionalTheme(), themes = useThemeChoices();
  const [open, setOpen] = useState(false), trigger = useRef<HTMLElement | null>(null);
  if (!appearance) return null;
  return <>
    <button type="button" className="v9-theme-button v8-press" aria-haspopup="dialog" onClick={event => { trigger.current = event.currentTarget; setOpen(true); }}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.7 1.6-1.5 0-.9-.7-1.3-.7-2.2 0-.9.7-1.6 1.7-1.6H17a4 4 0 0 0 4-4C21 6.7 17 3 12 3Z" /><circle cx="7.5" cy="11" r="1.2" /><circle cx="10.5" cy="7.3" r="1.2" /><circle cx="15" cy="7.6" r="1.2" /></svg>
      <span>{label ?? t.button}</span>
    </button>
    <MorphPanel open={open} onClose={() => setOpen(false)} triggerRef={trigger} title={t.title} closeLabel={t.done}>
      <p className="v9-theme-sheet-hint">{t.hint}</p>
      <ThemePicker themes={themes} value={appearance.theme} onChange={appearance.change} locale={locale} label={t.title} />
      {language && <div className="v9-theme-sheet-language"><span>{t.language}</span><SegmentedTabs label={t.language} value={locale} disabled={language.busy} options={[{ value: 'zh', label: '中文' }, { value: 'en', label: 'English' }]} onChange={value => language.onChange(value === 'en' ? 'en' : 'zh')} /></div>}
      <PrimaryButton onClick={() => setOpen(false)}>{t.done}</PrimaryButton>
    </MorphPanel>
  </>;
}
