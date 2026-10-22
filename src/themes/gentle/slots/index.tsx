import type * as P from '../../contract';
import * as Base from '../../base/slots';
import { PrimaryButton } from '../../../ui/components/kit/primitives';
import { YayaFigure } from '../../YayaFigure';
import './slots.css';

/** 温和陪伴 (Gentle.dc.html): white rounded cards, lime ringed buttons, the weekly sprout. */
export function BrandMark({ label }: P.BrandMarkProps) { return <span className="v8-brand v9-gentle-brand">{label}</span>; }
export function WeekProgress({ complete, partial, target, label }: P.WeekProgressProps) {
  const total = Math.max(0, Math.floor(target));
  const leaves = Array.from({ length: Math.min(3, Math.max(total, 1)) }, (_, index) => index < complete ? 'complete' : index < complete + partial ? 'partial' : 'empty');
  const paths = ['M48 70c-14 0-22-8-22-18 12 0 22 6 22 18z', 'M48 54c14 0 22-8 22-18-12 0-22 6-22 18z', 'M48 36c-10 0-16-7-16-15 9 0 16 5 16 15z'];
  return <div className="v8-week v9-gentle-week" aria-label={label}>
    <svg viewBox="0 0 96 110" aria-hidden="true"><path className="v9-gentle-pot" d="M20 96h56l-6 14H26z" /><rect className="v9-gentle-rim" x="16" y="88" width="64" height="10" rx="5" /><path className="v9-gentle-stem" d="M48 88V30" />
      {leaves.map((state, index) => <path key={index} d={paths[index]} data-state={state} className="v9-gentle-leaf" />)}</svg>
    <span>{label}</span></div>;
}
export function StartHero({ name, templateId, estimatedMinutes, startLabel, nextLabel, disabled, onStart }: P.StartHeroProps) {
  return <div className="v8-start v9-gentle-start" data-template-id={templateId}><YayaFigure mascot="gentle" pose="cheer" size={120} alt="" />
    {nextLabel && <span className="v9-gentle-kicker">{nextLabel}</span>}<h2>{name}</h2><span className="v8-minutes">{estimatedMinutes} min</span>
    <PrimaryButton disabled={disabled} onClick={onStart}>{startLabel}</PrimaryButton></div>;
}
export function Suggestions(props: P.SuggestionsProps) { return <div className="v9-gentle-suggestions"><Base.Suggestions {...props} /></div>; }
export function AiLine({ children }: P.AiLineProps) { return <div className="v8-ai-line v9-gentle-ai"><YayaFigure mascot="gentle" pose="head" size={48} alt="" /><div>{children}</div></div>; }
export function SetValue(props: P.SetValueProps) { return <div className="v9-gentle-set"><Base.SetValue {...props} /></div>; }
export function RestClock(props: P.RestClockProps) { return <div className="v9-gentle-rest"><span className="v9-gentle-breath" aria-hidden="true" /><Base.RestClock {...props} /></div>; }
export function FeatureCard({ children, context, motionReduced, trainingActive }: P.FeatureCardProps) {
  return <section className="v8-feature v8-sheet v9-gentle-feature" data-context={context} data-motion={motionReduced || trainingActive ? 'off' : 'on'}>{children}</section>;
}
export function NavIcon(props: P.NavIconProps) { return <span className="v9-gentle-nav" data-selected={props.selected}><Base.NavIcon {...props} /></span>; }
export const gentleSlots = { BrandMark, WeekProgress, StartHero, Suggestions, AiLine, SetValue, RestClock, FeatureCard, NavIcon };
