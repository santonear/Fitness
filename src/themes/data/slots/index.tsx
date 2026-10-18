import type * as P from '../../contract';
import * as Base from '../../base/slots';
import { PrimaryButton, ProgressRing } from '../../../ui/components/kit/primitives';
import { Yaya } from '../../../ui/components/Yaya';
import './slots.css';

/** 专业数据 (Data.dc.html): dark glass panels, cyan-blue jelly, glowing concentric rings, thin numerals. */
export function BrandMark({ label }: P.BrandMarkProps) { return <span className="v8-brand v9-data-brand">{label}</span>; }
export function WeekProgress({ complete, partial, target, label }: P.WeekProgressProps) {
  const total = Math.max(0, Math.floor(target));
  return <div className="v8-week v9-data-week" aria-label={label}>
    <ProgressRing value={total ? complete / total : 0} size={96} stroke={9} tone={1} dial={false}><b>{complete}<small>/{total}</small></b></ProgressRing>
    <span className="v9-data-week-text"><span>{label}</span>{partial > 0 && <small>+{partial}</small>}</span></div>;
}
export function StartHero({ name, templateId, estimatedMinutes, startLabel, nextLabel, disabled, onStart }: P.StartHeroProps) {
  return <div className="v8-start v9-data-start" data-template-id={templateId}><div className="v9-data-head"><span>{nextLabel}</span><span className="v9-data-num">{estimatedMinutes} min</span></div>
    <h2>{name}</h2><PrimaryButton disabled={disabled} onClick={onStart}>{startLabel}</PrimaryButton></div>;
}
export function Suggestions(props: P.SuggestionsProps) { return <div className="v9-data-suggestions"><Base.Suggestions {...props} /></div>; }
export function AiLine({ children }: P.AiLineProps) { return <div className="v8-ai-line v9-data-ai"><Yaya pose="head" size={40} alt="" /><div>{children}</div></div>; }
export function SetValue(props: P.SetValueProps) { return <div className="v9-data-set"><Base.SetValue {...props} /></div>; }
export function RestClock(props: P.RestClockProps) { return <div className="v9-data-rest"><Base.RestClock {...props} /></div>; }
export function FeatureCard({ children, context, motionReduced, trainingActive }: P.FeatureCardProps) {
  return <section className="v8-feature v8-sheet v9-flow v9-data-feature" data-context={context} data-motion={motionReduced || trainingActive ? 'off' : 'on'}>{children}</section>;
}
export function NavIcon(props: P.NavIconProps) { return <span className="v9-data-nav" data-selected={props.selected}><Base.NavIcon {...props} /></span>; }
export const dataSlots = { BrandMark, WeekProgress, StartHero, Suggestions, AiLine, SetValue, RestClock, FeatureCard, NavIcon };
