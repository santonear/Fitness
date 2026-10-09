import type { ThemeId } from './contract';
import { defaultThemeId, isThemeId } from './registry';

export const themeKey = 'fitness-theme';
export const legacyThemeKey = 'fitness-appearance-v31';
export type ThemeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** A valid V8 selection wins over a leftover V3.1 key. Writes happen outside render. */
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
    const next = isThemeId(previous) ? previous : defaultThemeId;
    storage.setItem(themeKey, next);
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
