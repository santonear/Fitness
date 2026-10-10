import type { AiLineProps, BrandMarkProps, FeatureCardProps, NavIconProps, RestClockProps, SetValueProps, StartHeroProps, SuggestionsProps, ThemeSlots, WeekProgressProps } from '../contract';
import { Button, Pressable } from '../../ui/components/common';

export function BrandMark({ label }: BrandMarkProps) { return <span className="v8-brand">{label}</span>; }
export function WeekProgress({ complete, partial, target, label }: WeekProgressProps) {
  return <div className="v8-week" aria-label={label}><span>{label}</span><span className="v8-week-dots" aria-hidden="true">{Array.from({ length: Math.max(0, Math.floor(target)) }, (_, index) => <i key={index} data-state={index < complete ? 'complete' : index < complete + partial ? 'partial' : 'empty'} />)}</span></div>;
}
export function StartHero({ name, templateId, estimatedMinutes, startLabel, disabled, onStart }: StartHeroProps) {
  return <div className="v8-start" data-template-id={templateId}><h2>{name}</h2><span className="v8-minutes">{estimatedMinutes} min</span><Button variant="primary" disabled={disabled} onClick={onStart}>{startLabel}</Button></div>;
}
export function Suggestions({ label, options, onSelect, disabled }: SuggestionsProps) {
  return <fieldset className="v8-suggestions" disabled={disabled}><legend>{label}</legend><div>{options.map(option => <Button key={option.id} onClick={() => onSelect(option.id)}>{option.label}</Button>)}</div></fieldset>;
}
export function AiLine({ children }: AiLineProps) { return <div className="v8-ai-line">{children}</div>; }
export function SetValue({ label, loadText, targetText, disabled, onEdit }: SetValueProps) {
  return <Pressable className="v8-set-value" aria-label={label} disabled={disabled} onClick={onEdit}><span>{loadText}</span><span aria-hidden="true">×</span><span>{targetText}</span></Pressable>;
}
export function RestClock({ elapsedSeconds, label }: RestClockProps) {
  const seconds = Math.max(0, Math.floor(elapsedSeconds));
  return <div className="v8-rest"><span aria-hidden="true">◉</span><span>{label}</span><time>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</time></div>;
}
export function FeatureCard({ children, context, motionReduced, trainingActive }: FeatureCardProps) {
  return <section className="v8-feature v8-sheet" data-context={context} data-motion={motionReduced || trainingActive ? 'off' : 'on'}>{children}</section>;
}
export function NavIcon({ kind, selected, label }: NavIconProps) {
  const path = { training: 'M20 22v20m24-20v20M20 32h24M15 25v14m34-14v14', plan: 'M23 20h18v27H23zM28 27h8m-8 7h8m-8 7h5', review: 'M20 44V32m12 12V22m12 22V16' }[kind];
  return <svg className="v8-nav-icon" data-selected={selected} viewBox="0 0 64 64" role="img" aria-label={label}><rect className="v8-nav-body" x="4" y="4" width="56" height="56" rx="18" /><path d={path} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></svg>;
}
export const baseSlots: ThemeSlots = { BrandMark, WeekProgress, StartHero, Suggestions, AiLine, SetValue, RestClock, FeatureCard, NavIcon };
