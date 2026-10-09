import type { ThemeId } from './contract';
import { defaultThemeId, isThemeId } from './registry';

export const themeKey = 'fitness-theme';
export const legacyThemeKey = 'fitness-appearance-v31';
export type ThemeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** Read the current V8 selection without mutating storage during render. */
export function readTheme(storage: ThemeStorage): ThemeId {
  try {
    const value = storage.getItem(themeKey);
    return isThemeId(value) ? value : defaultThemeId;
  } catch { return defaultThemeId; }
}

/** Retain the legacy key when the new preference cannot be saved. Safe to retry. */
export function migrateTheme(storage: ThemeStorage): boolean {
  try {
    const legacy = storage.getItem(legacyThemeKey);
    if (!['atlas', 'serene', 'orbit'].includes(legacy ?? '')) return true;
    const previous = storage.getItem(themeKey);
    // Coexisting valid keys need an explicit product precedence decision.
    if (isThemeId(previous)) return false;
    storage.setItem(themeKey, defaultThemeId);
    try { storage.removeItem(legacyThemeKey); }
    catch {
      if (previous === null) storage.removeItem(themeKey);
      else storage.setItem(themeKey, previous);
      return false;
    }
    return true;
  } catch { return false; }
}

export function saveTheme(storage: ThemeStorage, theme: ThemeId): boolean {
  try { storage.setItem(themeKey, theme); return true; } catch { return false; }
}
