import source from '../../docs/handoff-v8/02-design-tokens.json';
import type { ThemeId, ThemeTokenName } from './contract';

/** The JSON is the only value source; this adapter only assigns frozen CSS names. */
export function themeTokens(id: ThemeId): Partial<Record<ThemeTokenName, string | number>> {
  const { color: c, font: f, shape: s, tracking: t, material: m, effects: e } = source.themes[id];
  return {
    '--c-bg': c.bg, '--c-bg-grad': c.bgGradient, '--c-surface': c.surface,
    '--c-surface-2': c.surface2, '--c-ink': c.ink, '--c-ink-muted': c.inkMuted,
    '--c-line': c.line, '--c-primary': c.primary, '--c-on-primary': c.onPrimary,
    '--c-signature': c.signature, '--c-signature-2': c.signature2, '--c-done': c.done,
    '--c-on-done': c.onDone, '--c-attention': c.attention, '--c-ai': c.aiVoice,
    '--c-focus': c.focus, '--c-scrim': c.scrim,
    '--f-display': f.display, '--f-body': f.body, '--f-num': f.num,
    '--w-body': f.weightBody, '--w-display': f.weightDisplay, '--w-num': f.weightNum,
    '--w-strong': f.weightStrong,
    '--r-control': s.control, '--r-panel': s.panel, '--r-chip': s.chip, '--bw': s.border,
    '--tr-display': t.display, '--tr-body': t.body,
    '--mat-surface': m.surfaceGradient, '--mat-primary': m.primaryGradient,
    '--mat-hl': m.highlight, '--el-1': m.elevation1, '--el-2': m.elevation2,
    '--el-3': m.elevation3, '--press-inset': m.pressInset,
    '--ring': e.ring, '--ring-w': e.ringWidth, '--glow': e.glow, '--glow-blur': e.glowBlur,
    '--press-transform': e.pressStyle === 'sink'
      ? `translate(${source.shared.motion.sinkTranslate}, ${source.shared.motion.sinkTranslate}) scale(${source.shared.motion.sinkScale})`
      : `scale(${source.shared.motion.pressScale})`,
    '--press-shadow': e.pressStyle === 'sink' ? source.shared.motion.sinkShadow : m.pressInset,
  };
}

export function sharedTokens(): Partial<Record<ThemeTokenName, string | number>> {
  const { space, type, motion: m, touch, lineHeight: lh, layout } = source.shared;
  return {
    ...Object.fromEntries(Object.entries(space).map(([key, value]) => [`--${key}`, value])),
    ...Object.fromEntries(Object.entries(type).map(([key, value]) => [`--${key}`, value])),
    '--press-scale': m.pressScale, '--press-dur': m.pressDuration, '--spring': m.springEasing,
    '--morph-dur': m.morphDuration, '--morph-ease': m.morphEasing,
    '--fade': `${m.fadeDuration} ${m.fadeEasing}`, '--breath': m.breathCycle,
    '--ring-cycle': m.ringCycle,
    '--touch-min': touch.min, '--touch-primary': touch.primaryAction, '--touch-workout': touch.workoutAction,
    '--touch-secondary': touch.secondaryAction, '--touch-row': touch.row,
    '--lh-tight': lh.tight, '--lh-body': lh.body, '--lh-reading': lh.reading,
    '--layout-mobile-max': layout.mobileMax, '--layout-desktop-rail': layout.desktopRail,
    '--layout-desktop-main': layout.desktopMain, '--layout-desktop-breakpoint': layout.desktopBreakpoint,
  };
}

export function tokenBlock(selector: string, values: Record<string, string | number>) {
  return `${selector} {\n${Object.entries(values).map(([key, value]) => `  ${key}: ${value};`).join('\n')}\n}\n`;
}
