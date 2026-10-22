import type * as P from '../../contract';
import * as Base from '../../base/slots';
import { PrimaryButton, ProgressRing } from '../../../ui/components/kit/primitives';
import { YayaFigure } from '../../YayaFigure';
import './slots.css';

/** 柔光拟物 (Pop.dc.html): raised dials, recessed wells, warm amber gradient arcs. */
export function BrandMark({ label }: P.BrandMarkProps) {
  return (
    <span className="v8-brand v9-pop-brand">
      <span>fitness</span>
      <span>{label}</span>
      <i className="v9-brand-dash" aria-hidden="true" />
    </span>
  );
}
export function WeekProgress({ complete, partial, target, label }: P.WeekProgressProps) {
  const done = target > 0 ? Math.min(1, (complete + partial / 2) / target) : 0;
  return (
    <div className="v8-week v9-pop-week" aria-label={label}>
      <ProgressRing value={done} size={84} stroke={7}>
        <b>
          {complete}/{Math.max(0, Math.floor(target))}
        </b>
      </ProgressRing>
      <span>{label}</span>
    </div>
  );
}
export function StartHero({
  name,
  templateId,
  estimatedMinutes,
  startLabel,
  nextLabel,
  disabled,
  onStart,
}: P.StartHeroProps) {
  return (
    <div className="v8-start v9-pop-start" data-template-id={templateId}>
      {nextLabel && <span className="v8-next-label">{nextLabel}</span>}
      <h2>{name}</h2>
      <ProgressRing value={1} size={216} stroke={9}>
        <span className="v9-pop-minutes">
          {estimatedMinutes}
          <small>′</small>
        </span>
        <span className="v9-pop-unit">min</span>
      </ProgressRing>
      <PrimaryButton disabled={disabled} onClick={onStart}>
        {startLabel}
      </PrimaryButton>
    </div>
  );
}
export function Suggestions(props: P.SuggestionsProps) {
  return (
    <div className="v9-pop-suggestions">
      <Base.Suggestions {...props} />
    </div>
  );
}
export function AiLine({ children }: P.AiLineProps) {
  return (
    <div className="v8-ai-line v9-pop-ai">
      <YayaFigure mascot="pop" pose="head" size={56} alt="" />
      <div>{children}</div>
    </div>
  );
}
export function SetValue(props: P.SetValueProps) {
  return (
    <div className="v9-pop-dial">
      <Base.SetValue {...props} />
    </div>
  );
}
export function RestClock(props: P.RestClockProps) {
  return (
    <div className="v9-pop-dial v9-pop-rest">
      <Base.RestClock {...props} />
    </div>
  );
}
export function FeatureCard({ children, context, motionReduced, trainingActive }: P.FeatureCardProps) {
  return (
    <section
      className="v8-feature v8-sheet v9-pop-feature"
      data-context={context}
      data-motion={motionReduced || trainingActive ? 'off' : 'on'}
    >
      {children}
    </section>
  );
}
export function NavIcon(props: P.NavIconProps) {
  return (
    <span className="v9-pop-nav" data-selected={props.selected}>
      <Base.NavIcon {...props} />
    </span>
  );
}
export const popSlots = {
  BrandMark,
  WeekProgress,
  StartHero,
  Suggestions,
  AiLine,
  SetValue,
  RestClock,
  FeatureCard,
  NavIcon,
};
