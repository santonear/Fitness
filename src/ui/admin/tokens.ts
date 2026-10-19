import type { CSSProperties } from 'react';
import tokens from '../../../docs/handoff-v8/02-design-tokens.json';

// Legacy management page (?legacy=1): its own fixed palette, independent of the user's theme.
const { color, font } = tokens.admin;
export const adminTokens = {
  '--admin-bg': color.bg, '--admin-surface': color.surface, '--admin-soft': color.surface2,
  '--admin-ink': color.ink, '--admin-muted': color.inkMuted, '--admin-line': color.line,
  '--admin-primary': color.primary, '--admin-on-primary': color.onPrimary,
  '--admin-attention': color.attention, '--admin-focus': color.focus,
  '--admin-font': font.body, '--admin-text': tokens.shared.type.t3,
  '--admin-small': tokens.shared.type.t2, '--admin-row': tokens.shared.touch.min,
  '--admin-radius': tokens.shared.space.s2,
} as CSSProperties;

/**
 * Admin console tokens, from the approved V9 admin design (docs/design/v9/Admin.dc.html).
 * This is the only file in src/ui/admin allowed to hold literal colors; every
 * admin stylesheet and component reads these variables. The console never
 * follows the user's app theme.
 */
export const adminWorkspaceTokens = {
  // Surfaces
  '--a-canvas': '#E8E7E4',
  '--a-bg': '#F5F4F1',
  '--a-surface': '#FFFFFF',
  '--a-soft': '#F0EEEA',
  '--a-track': '#E9E7E3',
  '--a-hover': '#F7F6F3',
  // Text and lines
  '--a-ink': '#1B1B1A',
  '--a-ink-2': '#5E5D58',
  '--a-muted': '#6A6964',
  '--a-line': '#EFEDE9',
  '--a-line-strong': '#DAD7D1',
  // Dark navigation panel
  '--a-nav': '#232325',
  '--a-nav-top': '#46464A',
  '--a-nav-text': '#F2F1EE',
  '--a-nav-muted': '#C9C7C2',
  '--a-nav-hover': 'rgba(255,255,255,.08)',
  '--a-nav-active': 'rgba(255,255,255,.12)',
  '--a-nav-card': 'rgba(255,255,255,.07)',
  // Actions and states
  '--a-primary': '#1B1B1A',
  '--a-on-primary': '#FFFFFF',
  '--a-accent': '#E8603C',
  '--a-on-accent': '#FFFFFF',
  '--a-accent-soft': '#FBE4DA',
  '--a-accent-ink': '#933612',
  '--a-link': '#933612',
  '--a-focus': '#E8603C',
  '--a-ok': '#2F7A55',
  '--a-ok-soft': '#E3F0E8',
  '--a-warn': '#9A6B12',
  '--a-alert': '#A23C15',
  '--a-quiet': '#B9B6AF',
  '--a-backdrop': 'rgba(20,20,19,.42)',
  '--a-shadow': '0 1px 2px rgba(0,0,0,.03), 0 18px 44px rgba(0,0,0,.05)',
  '--a-shadow-dialog': '0 30px 80px rgba(0,0,0,.2)',
  '--a-shadow-chip': '0 1px 3px rgba(0,0,0,.08)',
  // Shape
  '--a-radius-panel': '36px',
  '--a-radius-nav': '32px',
  '--a-radius': '28px',
  '--a-radius-sm': '16px',
  '--a-button-radius': '999px',
  // Type
  '--a-font': "'Manrope', 'Noto Sans SC', system-ui, sans-serif",
  '--a-number': "'Manrope', 'Noto Sans SC', system-ui, sans-serif",
  '--a-small': '13px',
  '--a-body': '15px',
  '--a-h2': '22px',
  '--a-heading': 'clamp(30px, 3.4vw, 44px)',
  '--a-figure': '40px',
  // Touch
  '--a-row': '44px',
  '--a-row-touch': '48px',
} as CSSProperties;
