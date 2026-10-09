import tokens from '../../docs/handoff-v8/02-design-tokens.json';
import type { ThemeId, ThemeManifest } from './contract';

/** Preview images, font files and signature overrides arrive with the visual layer. */
export function createManifest(id: ThemeId): ThemeManifest {
  const theme = tokens.themes[id];
  return { id, name: theme.name, description: theme.tagline,
    colorScheme: theme.colorScheme === 'dark' ? 'dark' : 'light',
    preview: '', fonts: [], slots: {} };
}
