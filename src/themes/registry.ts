import { baseSlots } from './base/slots';
import type { ThemeId, ThemeManifest } from './contract';
import pop from './pop/manifest';
import vivid from './vivid/manifest';
import gentle from './gentle/manifest';
import data from './data/manifest';
import fire from './fire/manifest';

export const defaultThemeId: ThemeId = 'pop';
const builtins: readonly ThemeManifest[] = [pop, vivid, gentle, data, fire];
const discovered = import.meta.glob<{ default: ThemeManifest }>('./*/manifest.ts', { eager: true });
// Theme folders own their tokens and signature styles; pages need no imports.
import.meta.glob('./*/tokens.css', { eager: true });
export const themes: readonly ThemeManifest[] = [
  ...builtins,
  ...Object.entries(discovered)
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(
      ([path, { default: theme }]) =>
        path === `./${theme.id}/manifest.ts` && !builtins.some(item => item.id === theme.id),
    )
    .map(([, module]) => module.default),
];
export const fullthemes = themes;
export function getAvailableThemes(discoveryEnabled: boolean): readonly ThemeManifest[] {
  return discoveryEnabled ? themes : builtins;
}
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && themes.some(theme => theme.id === value);
}
export function getTheme(value: unknown): ThemeManifest {
  return themes.find(theme => theme.id === value) ?? pop;
}
export function getThemeSlots(value: unknown): import('./contract').ThemeSlots {
  return { ...baseSlots, ...getTheme(value).slots };
}
