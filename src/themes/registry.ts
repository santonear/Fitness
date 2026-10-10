import { baseSlots } from './base/slots';
import type { ThemeId, ThemeManifest } from './contract';
import qingci from './qingci/manifest';
import liubai from './liubai/manifest';
import jingshe from './jingshe/manifest';
import zhuangse from './zhuangse/manifest';

export const defaultThemeId: ThemeId = 'qingci';
export const themes: readonly ThemeManifest[] = [qingci, liubai, jingshe, zhuangse];
export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === 'string' && themes.some(theme => theme.id === value);
}
export function getTheme(value: unknown): ThemeManifest {
  return themes.find(theme => theme.id === value) ?? qingci;
}

/** Resolve signature overrides against the shared functional defaults. */
export function getThemeSlots(value: unknown): import('./contract').ThemeSlots {
  return { ...baseSlots, ...getTheme(value).slots };
}

