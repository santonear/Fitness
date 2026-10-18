import type { AiLineProps, BrandMarkProps, FeatureCardProps, NavIconProps, RestClockProps, SetValueProps, StartHeroProps, SuggestionsProps, ThemeSlots, WeekProgressProps } from '../contract';
import { Pressable } from '../../ui/components/common';
import { PrimaryButton } from '../../ui/components/kit/primitives';

/** Line icons shared by every V9 tab bar (今天 / 计划 / 回顾 / 我的). */
export const navGlyphs: Record<NavIconProps['kind'], string> = {
  training: 'M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5',
  plan: 'M7 5h10a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V8a3 3 0 0 1 3-3zM4 10h16M9 3v4M15 3v4',
  review: 'M3 17c3 0 4-8 7-8s3 6 6 6 3-6 5-8',
  me: 'M12 4a4 4 0 1 0 0 8a4 4 0 1 0 0-8M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6',
};
export const clock = (value: number) => { const s = Math.max(0, Math.floor(value)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export function BrandMark({ label }: BrandMarkProps) { return <span className="v8-brand"><span>{label}</span><i className="v9-brand-dash" aria-hidden="true" /></span>; }
export function WeekProgress({ complete, partial, target, label }: WeekProgressProps) {
  return <div className="v8-week" aria-label={label}><span>{label}</span><span className="v8-week-dots" aria-hidden="true">{Array.from({ length: Math.max(0, Math.floor(target)) }, (_, index) => <i key={index} data-state={index < complete ? 'complete' : index < complete + partial ? 'partial' : 'empty'} />)}</span></div>;
}
export function StartHero({ name, templateId, estimatedMinutes, startLabel, nextLabel, disabled, onStart }: StartHeroProps) {
  return <div className="v8-start" data-template-id={templateId}>{nextLabel && <span className="v8-next-label">{nextLabel}</span>}<h2>{name}</h2><span className="v8-minutes"><b>{estimatedMinutes}</b> min</span>
    <PrimaryButton disabled={disabled} onClick={onStart}>{startLabel}</PrimaryButton></div>;
}
export function Suggestions({ label, options, onSelect, disabled }: SuggestionsProps) {
  return <fieldset className="v8-suggestions" disabled={disabled}><legend>{label}</legend><div>{options.map(option => <Pressable key={option.id} className="v9-chip" data-size="sm" onClick={() => onSelect(option.id)}>{option.label}</Pressable>)}</div></fieldset>;
}
export function AiLine({ children }: AiLineProps) { return <div className="v8-ai-line">{children}</div>; }
export function SetValue({ label, loadText, targetText, disabled, onEdit }: SetValueProps) {
  return <Pressable className="v8-set-value" aria-label={label} disabled={disabled} onClick={onEdit}><span>{loadText}</span><span aria-hidden="true">×</span><span>{targetText}</span></Pressable>;
}
export function RestClock({ elapsedSeconds, label }: RestClockProps) {
  return <div className="v8-rest"><span className="v8-rest-label">{label}</span><time>{clock(elapsedSeconds)}</time></div>;
}
export function FeatureCard({ children, context, motionReduced, trainingActive }: FeatureCardProps) {
  return <section className="v8-feature v8-sheet" data-context={context} data-motion={motionReduced || trainingActive ? 'off' : 'on'}>{children}</section>;
}
export function NavIcon({ kind, selected, label }: NavIconProps) {
  return <svg className="v8-nav-icon" data-selected={selected} viewBox="0 0 24 24" role="img" aria-label={label}><path d={navGlyphs[kind]} /></svg>;
}
export const baseSlots: ThemeSlots = { BrandMark, WeekProgress, StartHero, Suggestions, AiLine, SetValue, RestClock, FeatureCard, NavIcon };
