import type { ComponentType, ReactNode } from 'react';
import type tokens from '../../docs/handoff-v8/02-design-tokens.json';

/** V9 contract: five built-in themes (pop default, vivid, gentle, data, fire). */
export type BuiltinThemeId = keyof typeof tokens.themes;
export type ThemeId = BuiltinThemeId | (string & {});
export type TokenSource = typeof tokens;
export type SceneVariant = keyof typeof tokens.shared.scene;
export type YayaPose = 'front' | 'head' | 'wave' | 'cheer' | 'think' | 'thanks' | 'care' | 'celebrate' | 'side' | 'back';
export interface BrandMarkProps { label: string }
export interface WeekProgressProps { complete: number; partial: number; target: number; label: string }
export interface StartHeroProps { templateLabel?: string; nextLabel?: string; name: string; templateId: string; estimatedMinutes: number; startLabel: string; disabled?: boolean; onStart: () => void }
export interface SuggestionsProps { label: string; options: readonly { id: string; label: string }[]; onSelect: (id: string) => void; disabled?: boolean }
export interface AiLineProps { children: ReactNode }
export interface SetValueProps { label: string; loadText: string; targetText: string; disabled?: boolean; onEdit: () => void }
export interface RestClockProps { elapsedSeconds: number; label: string }
export interface FeatureCardProps { children: ReactNode; context: 'next' | 'finish' | 'review'; motionReduced: boolean; trainingActive: boolean }
export interface NavIconProps { kind: 'training' | 'plan' | 'review' | 'me'; selected: boolean; label: string }
export interface ThemeSlots {
  BrandMark: ComponentType<BrandMarkProps>;
  WeekProgress: ComponentType<WeekProgressProps>;
  StartHero: ComponentType<StartHeroProps>;
  Suggestions: ComponentType<SuggestionsProps>;
  AiLine: ComponentType<AiLineProps>;
  SetValue: ComponentType<SetValueProps>;
  RestClock: ComponentType<RestClockProps>;
  FeatureCard: ComponentType<FeatureCardProps>;
  NavIcon: ComponentType<NavIconProps>;
}
export interface ThemeManifest {
  id: string;
  name: { zh: string; en: string };
  description: { zh: string; en: string };
  colorScheme: 'light' | 'dark';
  preview: string;
  /** Picker swatch: accent paint and base background, from the token JSON. */
  swatch: { accent: string; base: string };
  /** Which public/yaya/<pose>-<mascot>.webp set the mascot uses; discovered themes default to pop. */
  mascot?: BuiltinThemeId;
  themeColor?: string;
  fonts: readonly string[];
  slots: Partial<ThemeSlots>;
}

/** Semantic CSS token keys; values remain exclusively in the JSON source. Scene artwork uses `--scene-*` on `.v9-scene`. */
export type ThemeTokenName = SharedLayoutTokenName | "--c-bg" | "--c-bg-grad" | "--c-surface" | "--c-surface-2" | "--c-ink" | "--c-ink-muted" | "--c-faint" | "--c-line" | "--c-primary" | "--c-on-primary" | "--c-signature" | "--c-signature-2" | "--c-accent-text" | "--c-done" | "--c-on-done" | "--c-attention" | "--c-warn" | "--c-warn-soft" | "--c-ai" | "--c-inset" | "--c-invert-bg" | "--c-invert-ink" | "--c-focus" | "--c-scrim" | "--f-display" | "--f-body" | "--f-num" | "--f-num-style" | "--f-num-stretch" | "--w-body" | "--w-display" | "--w-num" | "--w-strong" | "--r-control" | "--r-panel" | "--r-chip" | "--r-hero" | "--bw" | "--tr-display" | "--tr-body" | "--tr-button" | "--mat-surface" | "--mat-primary" | "--mat-hl" | "--el-1" | "--el-2" | "--el-3" | "--el-inset" | "--el-primary" | "--press-inset" | "--ring" | "--ring-w" | "--glow" | "--glow-blur" | "--glow-ambient" | "--grad-accent" | "--grad-hero" | "--glass-bg" | "--glass-border" | "--glass-blur" | "--glass-shadow" | "--card-bg" | "--card-shadow" | "--card-border" | "--card-blur" | "--meter-from" | "--meter-to" | "--meter-glow" | "--chart-1" | "--chart-2" | "--chart-3" | "--chart-4" | "--chart-track" | "--yaya-accent" | "--yaya-disc" | "--orb-ring" | "--orb-core" | "--orb-ink" | "--orb-sub" | "--orb-glass" | "--orb-border" | "--orb-shadow" | "--orb-drop" | "--orb-action" | "--orb-action-line" | "--orb-cta" | "--orb-cta-ink" | "--press-scale" | "--press-dur" | "--spring" | "--morph-dur" | "--morph-ease" | "--fade" | "--breath" | "--ring-cycle" | "--float-cycle" | "--snap-ease" | "--pop-ease" | "--t1" | "--t2" | "--t3" | "--t4" | "--t5" | "--t6" | "--t7" | "--t8" | "--s1" | "--s2" | "--s3" | "--s4" | "--s5" | "--s6" | "--s7" | "--s8" | "--c-ai-panel" | "--grain-card" | "--grain-wood" | "--emboss" | "--relief-hi" | "--relief-drop" | "--hero-bw" | "--hero-frame" | "--hero-shadow" | "--hero-inner-line" | "--hero-text-shadow" | "--hero-muted" | "--hero-line" | "--hero-line-w" | "--hero-hatch" | "--hero-blend" | "--cal-r" | "--cal-today-bg" | "--cal-today-ink" | "--cal-today-ring" | "--cal-planned-bg" | "--cal-planned-ink" | "--cal-planned-ring" | "--cal-done-bg" | "--cal-done-ink" | "--cal-done-shadow" | "--cal-partial-rest" | "--cal-partial-ink" | "--cal-missed-line" | "--cal-missed-ink" | "--cal-selected-ring";

/** Shared layout keys (V8.0.3, V9 adds orb and tab bar). */
export type SharedLayoutTokenName = "--yaya-shadow" | "--orb-size" | "--orb-safe" | "--tabbar-h" | "--touch-min" | "--touch-primary" | "--touch-workout" | "--touch-secondary" | "--touch-row" | "--lh-tight" | "--lh-body" | "--lh-reading" | "--layout-mobile-max" | "--layout-desktop-rail" | "--layout-desktop-main" | "--layout-desktop-breakpoint" | "--press-transform" | "--press-shadow";

