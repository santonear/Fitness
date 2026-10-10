import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import tokens from '../../docs/handoff-v8/02-design-tokens.json';
import type { ThemeId, ThemeManifest } from './contract';
import { defaultThemeId, getTheme, isThemeId } from './registry';
import { migrateTheme, readTheme, saveTheme, themeKey } from './preference';

interface ThemeContextValue { theme: ThemeId; manifest: ThemeManifest; change: (theme: ThemeId) => void }
const Context = createContext<ThemeContextValue | null>(null);
function readBrowserTheme(): ThemeId {
  try { return readTheme(window.localStorage); } catch { return defaultThemeId; }
}

/** Mount once around the future V8 routes; never key children by the selected theme. */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState(readBrowserTheme);
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
    document.documentElement.style.colorScheme = getTheme(theme).colorScheme;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.append(meta);
    }
    meta.content = tokens.themes[theme].color.bg;
  }, [theme]);
  const change = useCallback((next: ThemeId) => {
    if (!isThemeId(next)) return;
    setTheme(next);
    try { saveTheme(window.localStorage, next); } catch { /* Keep the in-memory choice usable. */ }
  }, []);
  const value = useMemo(() => ({ theme, manifest: getTheme(theme), change }), [theme, change]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useTheme(): ThemeContextValue {
  const context = useContext(Context);
  if (!context) throw new Error('useTheme requires ThemeProvider');
  return context;
}
