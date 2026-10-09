import type { ComponentType, ReactNode } from 'react';
import type tokens from '../../docs/handoff-v8/02-design-tokens.json';

/** Wave 0 contract. No provider, theme rendering or preference mutation. */
export type ThemeId = keyof typeof tokens.themes;
export type TokenSource = typeof tokens;
export interface BrandMarkProps { label: string }
export interface WeekProgressProps { complete: number; partial: number; target: number; label: string }
export interface StartHeroProps { name: string; templateId: string; estimatedMinutes: number; startLabel: string; disabled?: boolean; onStart: () => void }
export interface SuggestionsProps { label: string; options: readonly { id: string; label: string }[]; onSelect: (id: string) => void; disabled?: boolean }
export interface AiLineProps { children: ReactNode }
export interface SetValueProps { label: string; loadText: string; targetText: string; disabled?: boolean; onEdit: () => void }
export interface RestClockProps { elapsedSeconds: number; label: string }
export interface FeatureCardProps { children: ReactNode; context: 'next' | 'finish' | 'review'; motionReduced: boolean; trainingActive: boolean }
export interface NavIconProps { kind: 'training' | 'plan' | 'review'; selected: boolean; label: string }
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
  fonts: readonly string[];
  slots: Partial<ThemeSlots>;
}

/** Semantic CSS token keys; values remain exclusively in the JSON source. */
export type ThemeTokenName = "--c-bg" | "--c-bg-grad" | "--c-surface" | "--c-surface-2" | "--c-ink" | "--c-ink-muted" | "--c-line" | "--c-primary" | "--c-on-primary" | "--c-signature" | "--c-signature-2" | "--c-done" | "--c-on-done" | "--c-attention" | "--c-ai" | "--c-focus" | "--c-scrim" | "--f-display" | "--f-body" | "--f-num" | "--w-body" | "--w-display" | "--w-num" | "--w-strong" | "--r-control" | "--r-panel" | "--r-chip" | "--bw" | "--tr-display" | "--tr-body" | "--mat-surface" | "--mat-primary" | "--mat-hl" | "--el-1" | "--el-2" | "--el-3" | "--press-inset" | "--ring" | "--ring-w" | "--glow" | "--glow-blur" | "--press-scale" | "--press-dur" | "--spring" | "--morph-dur" | "--morph-ease" | "--fade" | "--breath" | "--ring-cycle" | "--t1" | "--t2" | "--t3" | "--t4" | "--t5" | "--t6" | "--t7" | "--t8" | "--s1" | "--s2" | "--s3" | "--s4" | "--s5" | "--s6" | "--s7" | "--s8";
