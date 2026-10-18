import { describe, expect, it } from 'vitest';
import tokens from '../../docs/handoff-v8/02-design-tokens.json';
import { defaultThemeId, getAvailableThemes, getTheme, isThemeId, themes } from '../../src/themes/registry';
import { legacyThemeKey, migrateTheme, readTheme, resolveTheme, saveTheme, themeKey, type ThemeStorage } from '../../src/themes/preference';

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return { values, getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); } } satisfies ThemeStorage & { values: Map<string, string> };
}
describe('V9 theme registry', () => {
  it('registers exactly the five V9 themes in picker order with matching bilingual metadata and scheme', () => {
    expect(themes.map(theme => theme.id)).toEqual(['pop', 'vivid', 'gentle', 'data', 'fire']);
    expect(getAvailableThemes(false).map(theme => theme.id)).toEqual(Object.keys(tokens.themes));
    for (const theme of themes) {
      expect(isThemeId(theme.id)).toBe(true);
      const source = tokens.themes[theme.id as keyof typeof tokens.themes];
      expect(theme.name).toEqual(source.name);
      expect(theme.description).toEqual(source.tagline);
      expect(theme.colorScheme).toBe(source.colorScheme);
      expect(theme.mascot).toBe(theme.id);
    }
    expect(defaultThemeId).toBe('pop');
    expect(tokens.defaultTheme).toBe('pop');
    expect(themes.filter(theme => theme.colorScheme === 'dark').map(theme => theme.id)).toEqual(['data', 'fire']);
    expect(getTheme('unknown').id).toBe('pop');
    expect(isThemeId('toString')).toBe(false);
  });
  it('retires the four V8 themes from the picker', () => {
    for (const id of ['qingci', 'liubai', 'jingshe', 'zhuangse']) {
      expect(isThemeId(id)).toBe(false);
      expect(getAvailableThemes(true).some(theme => theme.id === id)).toBe(false);
    }
  });
});
describe('V9 browser preference', () => {
  it.each([['qingci', 'pop'], ['liubai', 'gentle'], ['jingshe', 'data'], ['zhuangse', 'fire'], ['unknown', 'pop'], ['', 'pop'], ['toString', 'pop']])('migrates stored %s to %s idempotently', (stored, expected) => {
    const store = storage({ [themeKey]: stored });
    expect(readTheme(store)).toBe(expected);
    expect(migrateTheme(store)).toBe(true);
    expect(store.values).toEqual(new Map([[themeKey, expected]]));
    expect(migrateTheme(store)).toBe(true);
    expect(store.values).toEqual(new Map([[themeKey, expected]]));
    expect(readTheme(store)).toBe(expected);
  });
  it('keeps every valid V9 choice untouched', () => {
    for (const id of ['pop', 'vivid', 'gentle', 'data', 'fire']) {
      const store = storage({ [themeKey]: id });
      expect(migrateTheme(store)).toBe(true);
      expect(store.values).toEqual(new Map([[themeKey, id]]));
    }
    expect(resolveTheme(null)).toBe('pop');
  });
  it('leaves an empty store empty', () => {
    const store = storage();
    expect(migrateTheme(store)).toBe(true);
    expect(store.values.size).toBe(0);
    expect(readTheme(store)).toBe('pop');
  });
  it.each(['atlas', 'serene', 'orbit'])('migrates the V3.1 %s key to pop and is idempotent', legacy => {
    const store = storage({ [legacyThemeKey]: legacy });
    expect(migrateTheme(store)).toBe(true);
    expect(store.values).toEqual(new Map([[themeKey, 'pop']]));
    expect(migrateTheme(store)).toBe(true);
    expect(readTheme(store)).toBe('pop');
  });
  it('maps a retired V8 choice forward without deleting a coexisting V3.1 preference', () => {
    const store = storage({ [themeKey]: 'jingshe', [legacyThemeKey]: 'atlas' });
    expect(migrateTheme(store)).toBe(true);
    expect(readTheme(store)).toBe('data');
    expect(store.values).toEqual(new Map([[themeKey, 'data'], [legacyThemeKey, 'atlas']]));
  });
  it('falls back on inaccessible storage', () => {
    const store = storage();
    store.getItem = () => { throw new Error('denied'); };
    expect(readTheme(store)).toBe('pop');
    expect(migrateTheme(store)).toBe(false);
  });
  it('keeps the old value when writing fails, while reads still resolve it', () => {
    const store = storage({ [themeKey]: 'zhuangse' });
    store.setItem = () => { throw new Error('quota'); };
    expect(migrateTheme(store)).toBe(false);
    expect(store.values).toEqual(new Map([[themeKey, 'zhuangse']]));
    expect(readTheme(store)).toBe('fire');
    expect(saveTheme(store, 'gentle')).toBe(false);
  });
  it('keeps the V3.1 preference when writing fails', () => {
    const store = storage({ [legacyThemeKey]: 'orbit' });
    store.setItem = () => { throw new Error('quota'); };
    expect(migrateTheme(store)).toBe(false);
    expect(store.values).toEqual(new Map([[legacyThemeKey, 'orbit']]));
  });
  it('rolls back when deleting the V3.1 key fails', () => {
    const store = storage({ [legacyThemeKey]: 'atlas' });
    const remove = store.removeItem;
    store.removeItem = key => { if (key === legacyThemeKey) throw new Error('denied'); remove(key); };
    expect(migrateTheme(store)).toBe(false);
    expect(store.values).toEqual(new Map([[legacyThemeKey, 'atlas']]));
  });
  it('normalizes an unknown value before considering the V3.1 key, then keeps both', () => {
    const store = storage({ [legacyThemeKey]: 'atlas', [themeKey]: 'invalid' });
    expect(migrateTheme(store)).toBe(true);
    expect(store.values).toEqual(new Map([[legacyThemeKey, 'atlas'], [themeKey, 'pop']]));
  });
  it('saves and reads all registered choices', () => {
    const store = storage();
    for (const id of ['pop', 'vivid', 'gentle', 'data', 'fire'] as const) {
      expect(saveTheme(store, id)).toBe(true);
      expect(readTheme(store)).toBe(id);
    }
  });
});
