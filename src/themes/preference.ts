import tokens from '../../docs/handoff-v8/02-design-tokens.json';
import type { ThemeId } from './contract';
import { defaultThemeId, isThemeId } from './registry';

export const themeKey = 'fitness-theme';
export const legacyThemeKey = 'fitness-appearance-v31';
export type ThemeStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

/** V8 theme ids retired by V9, with their approved successors. */
export const retiredThemes: Readonly<Record<string, ThemeId>> = tokens.legacyThemes;

/** Resolve a stored value to a registered theme: valid ids stay, retired V8 ids map forward, anything else is the default. */
export function resolveTheme(value: string | null): ThemeId {
  if (isThemeId(value)) return value;
  if (value !== null && Object.hasOwn(retiredThemes, value)) return retiredThemes[value];
  return defaultThemeId;
}

/** Read the current selection without mutating storage during render. */
export function readTheme(storage: ThemeStorage): ThemeId {
  try { return resolveTheme(storage.getItem(themeKey)); } catch { return defaultThemeId; }
}

/**
 * Idempotent: rewrites retired V8 ids (qingci→pop, liubai→gentle, jingshe→data, zhuangse→fire)
 * and unknown values to pop, then retires the V3.1 key. A failed write leaves the previous value.
 */
export function migrateTheme(storage: ThemeStorage): boolean {
  try {
    const stored = storage.getItem(themeKey);
    if (stored !== null && !isThemeId(stored)) storage.setItem(themeKey, resolveTheme(stored));
    const legacy = storage.getItem(legacyThemeKey);
    if (!['atlas', 'serene', 'orbit'].includes(legacy ?? '')) return true;
    const previous = storage.getItem(themeKey);
    // Keep the explicit V8/V9 choice and the old key; coexistence does not require migration.
    if (isThemeId(previous)) return true;
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
