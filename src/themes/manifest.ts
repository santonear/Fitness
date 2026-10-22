import { themeFonts } from './fonts';
import tokens from '../../docs/handoff-v8/02-design-tokens.json';
import type { BuiltinThemeId, ThemeManifest } from './contract';

/** Builds a built-in manifest from the V9 token source; slots are attached by each theme folder. */
export function createManifest(id: BuiltinThemeId): ThemeManifest {
  const theme = tokens.themes[id];
  return {
    id,
    name: theme.name,
    description: theme.tagline,
    colorScheme: theme.colorScheme === 'dark' ? 'dark' : 'light',
    preview: `/themes/${id}.svg`,
    swatch: { accent: theme.picker.swatch, base: theme.picker.base },
    themeColor: theme.color.bg,
    mascot: id,
    fonts: themeFonts[id],
    slots: {},
  };
}
