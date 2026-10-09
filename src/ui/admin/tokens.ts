import type { CSSProperties } from 'react';
import tokens from '../../../docs/handoff-v8/02-design-tokens.json';

// Admin is intentionally independent of the user's theme, using canonical celadon values.
const { color, font } = tokens.themes.qingci;
export const adminTokens = {
  '--admin-bg': color.bg, '--admin-surface': color.surface, '--admin-soft': color.surface2,
  '--admin-ink': color.ink, '--admin-muted': color.inkMuted, '--admin-line': color.line,
  '--admin-primary': color.primary, '--admin-on-primary': color.onPrimary,
  '--admin-attention': color.attention, '--admin-focus': color.focus,
  '--admin-font': font.body, '--admin-text': tokens.shared.type.t3,
  '--admin-small': tokens.shared.type.t2, '--admin-row': tokens.shared.touch.min,
  '--admin-radius': tokens.shared.space.s2,
} as CSSProperties;
