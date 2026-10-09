import { describe, expect, it } from 'vitest';
import tokens from '../../docs/handoff-v8/02-design-tokens.json';
import { defaultThemeId, getTheme, isThemeId, themes } from '../../src/themes/registry';
import { legacyThemeKey, migrateTheme, readTheme, saveTheme, themeKey, type ThemeStorage } from '../../src/themes/preference';

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } } satisfies ThemeStorage & { values: Map<string, string> };
}
describe('V8 theme registry', () => {
  it('registers exactly the token themes with matching bilingual metadata and scheme', () => {
    expect(themes.map(theme => theme.id)).toEqual(Object.keys(tokens.themes));
    for (const theme of themes) {
      expect(isThemeId(theme.id)).toBe(true);
      const source = tokens.themes[theme.id as keyof typeof tokens.themes];
      expect(theme.name).toEqual(source.name);
      expect(theme.description).toEqual(source.tagline);
      expect(theme.colorScheme).toBe(source.colorScheme);
    }
    expect(getTheme('unknown').id).toBe(defaultThemeId);
    expect(isThemeId('toString')).toBe(false);
  });
});
describe('V8 browser preference', () => {
  it.each(['atlas', 'serene', 'orbit'])('migrates %s and is idempotent', legacy => {
    const store = storage({ [legacyThemeKey]: legacy });
    expect(migrateTheme(store)).toBe(true);
    expect(store.values).toEqual(new Map([[themeKey, 'qingci']]));
    expect(migrateTheme(store)).toBe(true);
    expect(readTheme(store)).toBe('qingci');
  });
  it('retains an existing V8 choice when cleaning a leftover legacy key', () => {
    const store = storage({ [themeKey]: 'jingshe', [legacyThemeKey]: 'atlas' });
    expect(migrateTheme(store)).toBe(true);
    expect(store.values).toEqual(new Map([[themeKey, 'jingshe']]));
  });
  it('falls back on invalid values and inaccessible storage', () => {
    expect(readTheme(storage({ [themeKey]: 'atlas' }))).toBe('qingci');
    const store = storage();
    store.getItem = () => { throw new Error('denied'); };
    expect(readTheme(store)).toBe('qingci');
    expect(migrateTheme(store)).toBe(false);
  });
  it('keeps the old preference when writing fails', () => {
    const store = storage({ [legacyThemeKey]: 'orbit' });
    store.setItem = () => { throw new Error('quota'); };
    expect(migrateTheme(store)).toBe(false);
    expect(store.values).toEqual(new Map([[legacyThemeKey, 'orbit']]));
    expect(saveTheme(store, 'liubai')).toBe(false);
  });
  it.each([null, 'invalid'])('rolls back %s when deleting the legacy key fails', previous => {
    const store = storage({ [legacyThemeKey]: 'atlas', ...(previous === null ? {} : { [themeKey]: previous }) });
    const before = new Map(store.values);
    const remove = store.removeItem;
    store.removeItem = key => { if (key === legacyThemeKey) throw new Error('denied'); remove(key); };
    expect(migrateTheme(store)).toBe(false);
    expect(store.values).toEqual(before);
  });
  it('saves and reads all registered choices', () => {
    const store = storage();
    for (const id of ['qingci', 'liubai', 'jingshe', 'zhuangse'] as const) {
      expect(saveTheme(store, id)).toBe(true);
      expect(readTheme(store)).toBe(id);
    }
  });
});
