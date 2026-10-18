import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import source from '../../docs/handoff-v8/02-design-tokens.json';
import type { BuiltinThemeId } from '../../src/themes/contract';
import { baseTokenCss, sceneTokens, sceneVariants, sharedTokens, themeSelector, themeTokens, tokenBlock } from '../../src/themes/token-css';

const themes = Object.keys(source.themes) as BuiltinThemeId[];
const generatedHeader = '/* Generated from 02-design-tokens.json; checked by v8-theme-tokens.test.ts. */\n';
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n');

describe('V9 tokens', () => {
  it('keeps all shared CSS values and scene palettes synchronized with their JSON source', () => {
    expect(source.version).toBe('9.0.0');
    expect(read('src/themes/base/tokens.css')).toBe(generatedHeader + baseTokenCss());
    expect(sharedTokens()['--fade']).toBe('220ms cubic-bezier(.2,.7,.2,1)');
    expect(sharedTokens()['--press-scale']).toBe(0.96);
    for (const [key, value] of Object.entries({ ...source.shared.space, ...source.shared.type })) {
      expect(sharedTokens()).toHaveProperty(`--${key}`, value);
    }
    expect(sceneVariants).toEqual(['dawn', 'lake', 'dusk', 'mist', 'peak']);
    for (const variant of sceneVariants) expect(Object.keys(sceneTokens(variant))).toHaveLength(14);
  });

  for (const id of themes) {
    it(`${id}: every generated theme value matches the JSON adapter`, () => {
      const tokens = themeTokens(id);
      expect(read(`src/themes/${id}/tokens.css`)).toBe(generatedHeader + tokenBlock(themeSelector(id), tokens as Record<string, string | number>));
      expect(tokens['--c-ink']).toBe(source.themes[id].color.ink);
      expect(tokens['--f-num']).toBe(source.themes[id].font.num);
      expect(tokens['--el-2']).toBe(source.themes[id].material.elevation2);
      expect(tokens['--ring']).toBe(source.themes[id].effects.ring);
      expect(tokens['--yaya-accent']).toBe(source.themes[id].mascot.accent);
      expect(tokens['--card-bg']).toBe(source.themes[id].card.bg);
      expect(Object.keys(tokens).filter(key => key in sharedTokens())).toEqual([]);
      expect(Object.values(tokens).every(value => value !== undefined && value !== '')).toBe(true);
    });
  }

  it('maps every approved frozen name including V9 additions', () => {
    const contract = read('src/themes/contract.ts');
    const names = [...contract.matchAll(/"(--[\w-]+)"/g)].map(match => match[1]);
    for (const id of themes) {
      expect(Object.keys({ ...sharedTokens(), ...themeTokens(id) }).sort()).toEqual(names.sort());
      expect(themeTokens(id)['--w-strong']).toBe(source.themes[id].font.weightStrong);
    }
  });

  it('scopes theme blocks so pickers can render live previews', () => {
    expect(themeSelector('pop')).toBe(':root[data-theme="pop"], [data-theme="pop"]');
  });

  it('keeps body text readable in every theme (WCAG AA 4.5:1 for ink and muted ink on bg and surface)', () => {
    const luminance = (hex: string) => {
      const channels = hex.replace('#', '').match(/../g)!.map(part => parseInt(part, 16) / 255).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
      return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    };
    const ratio = (a: string, b: string) => { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
    for (const id of themes) {
      const { color } = source.themes[id];
      for (const ground of [color.bg, color.surface]) {
        expect(ratio(color.ink, ground), `${id} ink`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(color.inkMuted, ground), `${id} muted`).toBeGreaterThanOrEqual(4.5);
        expect(ratio(color.accentText, ground), `${id} accent text`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});
