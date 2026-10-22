import source from '../../docs/handoff-v8/02-design-tokens.json';
import type { BuiltinThemeId, SceneVariant, ThemeTokenName } from './contract';

/** The JSON is the only value source; this adapter only assigns frozen CSS names. */
export function themeTokens(id: BuiltinThemeId): Partial<Record<ThemeTokenName, string | number>> {
  const {
    color: c,
    font: f,
    shape: s,
    tracking: t,
    material: m,
    effects: e,
    gradient: g,
    glass,
    card,
    meter,
    chart,
    mascot: y,
    texture: x,
    relief,
    hero: h,
    calendar: cal,
    anatomy: am,
  } = source.themes[id];
  const pressScale = e.pressScale ?? source.shared.motion.pressScale;
  return {
    '--c-bg': c.bg,
    '--c-bg-grad': c.bgGradient,
    '--c-surface': c.surface,
    '--c-surface-2': c.surface2,
    '--c-ink': c.ink,
    '--c-ink-muted': c.inkMuted,
    '--c-faint': c.faint,
    '--c-line': c.line,
    '--c-primary': c.primary,
    '--c-on-primary': c.onPrimary,
    '--c-signature': c.signature,
    '--c-signature-2': c.signature2,
    '--c-accent-text': c.accentText,
    '--c-done': c.done,
    '--c-on-done': c.onDone,
    '--c-attention': c.attention,
    '--c-warn': c.warn,
    '--c-warn-soft': c.warnSoft,
    '--c-ai': c.aiVoice,
    '--c-inset': c.inset,
    '--c-invert-bg': c.invertBg,
    '--c-invert-ink': c.invertInk,
    '--c-focus': c.focus,
    '--c-scrim': c.scrim,
    '--f-display': f.display,
    '--f-body': f.body,
    '--f-num': f.num,
    '--f-num-style': f.numStyle,
    '--f-num-stretch': f.numStretch,
    '--w-body': f.weightBody,
    '--w-display': f.weightDisplay,
    '--w-num': f.weightNum,
    '--w-strong': f.weightStrong,
    '--r-control': s.control,
    '--r-panel': s.panel,
    '--r-chip': s.chip,
    '--r-hero': s.hero,
    '--bw': s.border,
    '--tr-display': t.display,
    '--tr-body': t.body,
    '--tr-button': t.button,
    '--mat-surface': m.surfaceGradient,
    '--mat-primary': m.primaryGradient,
    '--mat-hl': m.highlight,
    '--el-1': m.elevation1,
    '--el-2': m.elevation2,
    '--el-3': m.elevation3,
    '--el-inset': m.inset,
    '--el-primary': m.primaryShadow,
    '--press-inset': m.pressInset,
    '--ring': e.ring,
    '--ring-w': e.ringWidth,
    '--glow': e.glow,
    '--glow-blur': e.glowBlur,
    '--glow-ambient': e.ambient,
    '--grad-accent': g.accent,
    '--grad-hero': g.hero,
    '--glass-bg': glass.bg,
    '--glass-border': glass.border,
    '--glass-blur': glass.blur,
    '--glass-shadow': glass.shadow,
    '--card-bg': card.bg,
    '--card-shadow': card.shadow,
    '--card-border': card.border,
    '--card-blur': card.blur,
    '--meter-from': meter.from,
    '--meter-to': meter.to,
    '--meter-glow': meter.glow,
    '--chart-1': chart.c1,
    '--chart-2': chart.c2,
    '--chart-3': chart.c3,
    '--chart-4': chart.c4,
    '--chart-track': chart.track,
    '--yaya-accent': y.accent,
    '--yaya-disc': y.disc,
    '--orb-ring': y.orbRing,
    '--orb-core': y.orbCore,
    '--orb-ink': y.orbInk,
    '--orb-sub': y.orbSub,
    '--orb-glass': y.orbGlass,
    '--orb-border': y.orbBorder,
    '--orb-shadow': y.orbShadow,
    '--orb-drop': y.orbDrop,
    '--orb-action': y.orbAction,
    '--orb-action-line': y.orbActionLine,
    '--orb-cta': y.orbCta,
    '--orb-cta-ink': y.orbCtaInk,
    '--press-transform':
      e.pressStyle === 'sink'
        ? `translate(${source.shared.motion.sinkTranslate}, ${source.shared.motion.sinkTranslate}) scale(${source.shared.motion.sinkScale})`
        : `scale(${pressScale})`,
    '--press-shadow': e.pressStyle === 'sink' ? source.shared.motion.sinkShadow : m.pressInset,
    // V9 暖阳柔木: textures and relief (other themes set none / transparent and keep their look).
    '--c-ai-panel': c.aiPanel,
    '--grain-card': x.cardGrain,
    '--grain-wood': x.woodGrain,
    '--emboss': x.emboss,
    '--relief-hi': relief.highlight,
    '--relief-drop': relief.drop,
    '--hero-bw': h.border,
    '--hero-frame': h.frame,
    '--hero-shadow': h.shadow,
    '--hero-inner-line': h.innerLine,
    '--hero-text-shadow': h.textShadow,
    '--hero-muted': h.muted,
    '--hero-line': h.line,
    '--hero-line-w': h.lineWidth,
    '--hero-hatch': h.hatch,
    '--hero-blend': h.blend,
    // Month calendar states (计划 › 月, plan draft, training-day picker, 今天 week strip).
    '--cal-r': cal.radius,
    '--cal-today-bg': cal.todayBg,
    '--cal-today-ink': cal.todayInk,
    '--cal-today-ring': cal.todayRing,
    '--cal-today-from': cal.todayFrom,
    '--cal-today-to': cal.todayTo,
    '--cal-today-halo': cal.todayHalo,
    '--cal-today-glow': cal.todayGlow,
    '--cal-today-lift': cal.todayLift,
    '--cal-planned-bg': cal.plannedBg,
    '--cal-planned-ink': cal.plannedInk,
    '--cal-planned-ring': cal.plannedRing,
    '--cal-done-bg': cal.doneBg,
    '--cal-done-ink': cal.doneInk,
    '--cal-done-shadow': cal.doneShadow,
    '--cal-partial-rest': cal.partialRest,
    '--cal-partial-ink': cal.partialInk,
    '--cal-missed-line': cal.missedLine,
    '--cal-missed-ink': cal.missedInk,
    '--cal-selected-ring': cal.selectedRing,
    // V9.14 AnatomyMap: figure base, outline, primary glow, secondary fill, badge rim, label text, scan line.
    '--map-base': am.base,
    '--map-line': am.line,
    '--map-hot': am.hot,
    '--map-hot-ink': am.hotInk,
    '--map-sec': am.sec,
    '--map-sec-ink': am.secInk,
    '--map-ring': am.ring,
    '--map-text': am.text,
    '--map-scan': am.scan,
  };
}

export function sharedTokens(): Partial<Record<ThemeTokenName, string | number>> {
  const { space, type, motion: m, touch, lineHeight: lh, layout } = source.shared;
  return {
    ...Object.fromEntries(Object.entries(space).map(([key, value]) => [`--${key}`, value])),
    ...Object.fromEntries(Object.entries(type).map(([key, value]) => [`--${key}`, value])),
    '--press-scale': m.pressScale,
    '--press-dur': m.pressDuration,
    '--spring': m.springEasing,
    '--morph-dur': m.morphDuration,
    '--morph-ease': m.morphEasing,
    '--fade': `${m.fadeDuration} ${m.fadeEasing}`,
    '--breath': m.breathCycle,
    '--ring-cycle': m.ringCycle,
    '--float-cycle': m.floatCycle,
    '--snap-ease': m.snapEasing,
    '--pop-ease': m.popEasing,
    '--touch-min': touch.min,
    '--touch-primary': touch.primaryAction,
    '--touch-workout': touch.workoutAction,
    '--touch-secondary': touch.secondaryAction,
    '--touch-row': touch.row,
    '--lh-tight': lh.tight,
    '--lh-body': lh.body,
    '--lh-reading': lh.reading,
    '--layout-mobile-max': layout.mobileMax,
    '--layout-desktop-rail': layout.desktopRail,
    '--layout-desktop-main': layout.desktopMain,
    '--layout-desktop-breakpoint': layout.desktopBreakpoint,
    '--yaya-shadow': source.shared.mascot.shadow,
    '--orb-size': layout.orbSize,
    '--orb-safe': layout.orbSafe,
    '--tabbar-h': layout.tabbarHeight,
  };
}

/** Theme-independent landscape artwork palettes for the vivid Scene illustration. */
export function sceneTokens(variant: SceneVariant): Record<string, string> {
  return Object.fromEntries(
    Object.entries(source.shared.scene[variant]).map(([key, value]) => [`--scene-${key}`, value]),
  );
}
export const sceneVariants = Object.keys(source.shared.scene) as SceneVariant[];

/** Theme blocks also match scoped previews (`<div data-theme="gentle">`) so pickers can show live samples. */
export const themeSelector = (id: string) => `:root[data-theme="${id}"], [data-theme="${id}"]`;

export function tokenBlock(selector: string, values: Record<string, string | number>) {
  return `${selector} {\n${Object.entries(values)
    .map(([key, value]) => `  ${key}: ${value};`)
    .join('\n')}\n}\n`;
}

/** Complete generated contents of src/themes/base/tokens.css. */
export function baseTokenCss() {
  return (
    tokenBlock(':root', sharedTokens()) +
    sceneVariants.map(variant => tokenBlock(`.v9-scene[data-scene="${variant}"]`, sceneTokens(variant))).join('')
  );
}
