import type * as P from '../../contract';
import * as Base from '../../base/slots';
import { PrimaryButton } from '../../../ui/components/kit/primitives';
import './slots.css';

/** 燃动挑战 (Fire.dc.html): black with red glow, condensed numerals, one level a day, glass rows. */
export function BrandMark({ label }: P.BrandMarkProps) { return <span className="v8-brand v9-fire-brand">{label}</span>; }
export function WeekProgress({ complete, partial, target, label }: P.WeekProgressProps) {
  const total = Math.max(0, Math.floor(target));
  return <div className="v8-week v9-fire-week" aria-label={label}><span className="v9-fire-row"><span>{label}</span><b>{complete} / {total}</b></span>
    <span className="v9-fire-pills" aria-hidden="true">{Array.from({ length: total }, (_, index) => <i key={index} data-state={index < complete ? 'complete' : index < complete + partial ? 'partial' : 'empty'} />)}</span></div>;
}
export function StartHero({ name, templateId, estimatedMinutes, startLabel, nextLabel, disabled, onStart }: P.StartHeroProps) {
  return <div className="v8-start v9-fire-start" data-template-id={templateId}>{nextLabel && <span className="v9-fire-kicker">{nextLabel}</span>}<h2>{name}</h2>
    <span className="v9-fire-meta">{estimatedMinutes} MIN</span><PrimaryButton className="v9-fire-go" disabled={disabled} onClick={onStart}>{startLabel}</PrimaryButton></div>;
}
export function Suggestions(props: P.SuggestionsProps) { return <div className="v9-fire-suggestions"><Base.Suggestions {...props} /></div>; }
export function AiLine({ children }: P.AiLineProps) { return <div className="v8-ai-line v9-fire-ai">{children}</div>; }
export function SetValue(props: P.SetValueProps) { return <div className="v9-fire-set"><Base.SetValue {...props} /></div>; }
export function RestClock(props: P.RestClockProps) { return <div className="v9-fire-rest"><Base.RestClock {...props} /></div>; }
export function FeatureCard({ children, context, motionReduced, trainingActive }: P.FeatureCardProps) {
  return <section className="v8-feature v8-sheet v9-fire-feature" data-context={context} data-motion={motionReduced || trainingActive ? 'off' : 'on'}>{children}</section>;
}
export function NavIcon(props: P.NavIconProps) { return <span className="v9-fire-nav" data-selected={props.selected}><Base.NavIcon {...props} /></span>; }
export const fireSlots = { BrandMark, WeekProgress, StartHero, Suggestions, AiLine, SetValue, RestClock, FeatureCard, NavIcon };
