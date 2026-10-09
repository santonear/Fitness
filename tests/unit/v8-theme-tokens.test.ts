import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import source from '../../docs/handoff-v8/02-design-tokens.json';
import type { ThemeId } from '../../src/themes/contract';
import { sharedTokens, themeTokens, tokenBlock } from '../../src/themes/token-css';

const themes = Object.keys(source.themes) as ThemeId[];
const generatedHeader = '/* Generated from 02-design-tokens.json; checked by v8-theme-tokens.test.ts. */\n';
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');

describe('V8 tokens', () => {
  it('keeps all shared CSS values synchronized with their JSON source', () => {
    expect(read('src/themes/base/tokens.css')).toBe(generatedHeader + tokenBlock(':root', sharedTokens()));
    expect(sharedTokens()['--fade']).toBe('220ms cubic-bezier(.2,.7,.2,1)');
    expect(sharedTokens()['--press-scale']).toBe(0.96);
    for (const [key, value] of Object.entries({ ...source.shared.space, ...source.shared.type })) {
      expect(sharedTokens()).toHaveProperty(`--${key}`, value);
    }
  });

  for (const id of themes) {
    it(`${id}: every generated theme value matches the JSON adapter`, () => {
      const tokens = themeTokens(id);
      expect(read(`src/themes/${id}/tokens.css`)).toBe(generatedHeader + tokenBlock(`:root[data-theme="${id}"]`, tokens));
      expect(tokens['--c-ink']).toBe(source.themes[id].color.ink);
      expect(tokens['--f-num']).toBe(source.themes[id].font.num);
      expect(tokens['--el-2']).toBe(source.themes[id].material.elevation2);
      expect(tokens['--ring']).toBe(source.themes[id].effects.ring);
      expect(Object.keys(tokens).filter(key => key in sharedTokens())).toEqual([]);
      expect(Object.values(tokens).every(value => value !== undefined && value !== '')).toBe(true);
    });
  }

  it('maps every approved frozen name including V8.0.3 additions', () => {
    const contract = read('src/themes/contract.ts');
    const names = [...contract.matchAll(/"(--[\w-]+)"/g)].map(match => match[1]);
    for (const id of themes) {
      expect(Object.keys({ ...sharedTokens(), ...themeTokens(id) }).sort()).toEqual(names.sort());
      expect(themeTokens(id)['--w-strong']).toBe(source.themes[id].font.weightStrong);
    }
  });
});
