import './fonts/fonts.css';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import tokens from '../../docs/handoff-v8/02-design-tokens.json';
import { compactThemeFonts } from './fonts';
import type { ThemeId, ThemeManifest } from './contract';
import { defaultThemeId, getTheme, getAvailableThemes, isThemeId } from './registry';
import { isFeatureEnabled, subscribeFeatureFlags } from '../application/feature-flags';
import { migrateTheme, readTheme, saveTheme, themeKey } from './preference';

interface ThemeContextValue { theme: ThemeId; manifest: ThemeManifest; change: (theme: ThemeId) => void }
const Context = createContext<ThemeContextValue | null>(null);
function readBrowserTheme(): ThemeId {
  try { return readTheme(window.localStorage); } catch { return defaultThemeId; }
}

/** Mount once around the future V8 routes; never key children by the selected theme. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [selectedTheme, setTheme] = useState(readBrowserTheme);
  const discovery = useSyncExternalStore(subscribeFeatureFlags, () => isFeatureEnabled('themeDiscovery'), () => false);
  const compactFonts = useSyncExternalStore(subscribeFeatureFlags, () => isFeatureEnabled('fontSubset'), () => false);
  const theme = getAvailableThemes(discovery).some(item => item.id === selectedTheme) ? selectedTheme : defaultThemeId;
  useEffect(() => {
    try { migrateTheme(window.localStorage); } catch { /* Storage access can be disabled. */ }
    const sync = (event: StorageEvent) => {
      if (event.key === themeKey || event.key === null) setTheme(readBrowserTheme());
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    const fontTokens = theme in tokens.themes ? tokens.themes[theme as keyof typeof tokens.themes].font : undefined;
    for (const [property, name] of [['--f-body', 'body'], ['--f-display', 'display'], ['--f-num', 'num']] as const) {
      if (compactFonts && fontTokens && theme !== 'zhuangse') document.documentElement.style.setProperty(property, fontTokens[name].replace('Noto Sans SC', 'Noto Sans SC Compact').replace('Noto Serif SC', 'Noto Serif SC Compact'));
      else document.documentElement.style.removeProperty(property);
    }
    document.documentElement.style.colorScheme = getTheme(theme).colorScheme;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.append(meta);
    }
    meta.content = getTheme(theme).themeColor ?? (theme in tokens.themes ? tokens.themes[theme as keyof typeof tokens.themes].color.bg : getComputedStyle(document.documentElement).getPropertyValue('--c-bg').trim());
  }, [theme, compactFonts]);
  const change = useCallback((next: ThemeId) => {
    if (!isThemeId(next) || !getAvailableThemes(discovery).some(item => item.id === next)) return;
    setTheme(next);
    try { saveTheme(window.localStorage, next); } catch { /* Keep the in-memory choice usable. */ }
  }, [discovery]);
  const value = useMemo(() => ({ theme, manifest: compactFonts && theme in compactThemeFonts ? { ...getTheme(theme), fonts: compactThemeFonts[theme as keyof typeof compactThemeFonts] } : getTheme(theme), change }), [theme, change, compactFonts]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useTheme(): ThemeContextValue {
  const context = useContext(Context);
  if (!context) throw new Error('useTheme requires ThemeProvider');
  return context;
}

