import { useRef, useState, useSyncExternalStore } from 'react';
import { getAvailableThemes } from '../../themes/registry';
import { isFeatureEnabled, subscribeFeatureFlags } from '../../application/feature-flags';
import { useOptionalTheme } from '../../themes/ThemeProvider';
import { themeEntryCopy } from '../../i18n/features/home/theme';
import { MorphPanel } from './common';
import { PrimaryButton } from './kit';
import { ThemePicker } from './ThemePicker';
import './theme-sheet.css';

/** Built-in V9 themes; switching applies at once (same store as 我的 › 界面风格). */
function useThemeChoices() {
  const discovery = useSyncExternalStore(subscribeFeatureFlags, () => isFeatureEnabled('themeDiscovery'), () => false);
  const builtin = new Set(getAvailableThemes(false).map(theme => theme.id));
  return getAvailableThemes(discovery).filter(theme => builtin.has(theme.id));
}

interface LanguageChoice { onChange: (next: 'zh' | 'en') => void; busy?: boolean }
/**
 * Its own button next to 换风格 on 今天 and the welcome page (Bo 2026-10-21: language and style were hard to find
 * together). One tap switches to the other language; the visible text is that language's own name.
 */
export function LanguageButton({ locale, onChange, busy }: { locale: 'zh' | 'en' } & LanguageChoice) {
  const t = themeEntryCopy[locale], next = locale === 'zh' ? 'en' : 'zh';
  return <button type="button" className="v9-theme-button v9-language-button v8-press" lang={next} disabled={busy} aria-label={t.switchTo} onClick={() => onChange(next)}>
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.7 5.6 3.7 9s-1.2 6.4-3.7 9c-2.5-2.6-3.7-5.6-3.7-9S9.5 5.6 12 3Z" /></svg>
    <span>{next === 'en' ? 'English' : '中文'}</span>
  </button>;
}

/** Small, always-visible 换风格 button that opens the theme picker with live previews in a sheet. */
export function ThemeButton({ locale, label }: { locale: 'zh' | 'en'; /** Visible text; defaults to 换风格. */ label?: string }) {
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
      <PrimaryButton onClick={() => setOpen(false)}>{t.done}</PrimaryButton>
    </MorphPanel>
  </>;
}
