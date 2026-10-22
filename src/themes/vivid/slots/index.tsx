import type * as P from '../../contract';
import * as Base from '../../base/slots';
import { PrimaryButton } from '../../../ui/components/kit/primitives';
import { Scene } from '../../../ui/components/Scene';
import { YayaFigure } from '../../YayaFigure';
import './slots.css';

/** 山野暖阳 (Vivid.dc.html + Scene.dc.html): arched windows over hills, serif titles, italic numerals, clay buttons. */
export function BrandMark({ label }: P.BrandMarkProps) {
  return (
    <span className="v8-brand v9-vivid-brand">
      <span>{label}</span>
      <i aria-hidden="true" />
    </span>
  );
}
export function WeekProgress({ complete, partial, target, label }: P.WeekProgressProps) {
  const total = Math.max(0, Math.floor(target));
  return (
    <div className="v8-week v9-vivid-week" aria-label={label}>
      <span>{label}</span>
      <span className="v9-vivid-arches" aria-hidden="true">
        {Array.from({ length: total }, (_, index) => (
          <i
            key={index}
            data-state={index < complete ? 'complete' : index < complete + partial ? 'partial' : 'empty'}
          />
        ))}
      </span>
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
    <div className="v8-start v9-vivid-start" data-template-id={templateId}>
      <Scene variant="dawn" />
      <i className="v9-vivid-arch-line" aria-hidden="true" />
      <div className="v9-vivid-hero-text">
        {nextLabel && <span className="v9-vivid-spaced">{nextLabel}</span>}
        <i className="v9-vivid-rule" aria-hidden="true" />
        <h2>{name}</h2>
        <span className="v9-vivid-stat">
          <b>{estimatedMinutes}</b>
          <span>min</span>
        </span>
      </div>
      <PrimaryButton className="v9-vivid-hero-start" tone="quiet" disabled={disabled} onClick={onStart}>
        {startLabel}
      </PrimaryButton>
    </div>
  );
}
export function Suggestions(props: P.SuggestionsProps) {
  return (
    <div className="v9-vivid-suggestions">
      <Base.Suggestions {...props} />
    </div>
  );
}
export function AiLine({ children }: P.AiLineProps) {
  return (
    <div className="v8-ai-line v9-vivid-ai">
      <YayaFigure mascot="vivid" pose="care" size={88} alt="" />
      <div>{children}</div>
    </div>
  );
}
export function SetValue(props: P.SetValueProps) {
  return (
    <div className="v9-vivid-set">
      <Base.SetValue {...props} />
    </div>
  );
}
export function RestClock(props: P.RestClockProps) {
  return (
    <div className="v9-vivid-rest">
      <Base.RestClock {...props} />
    </div>
  );
}
export function FeatureCard({ children, context, motionReduced, trainingActive }: P.FeatureCardProps) {
  return (
    <section
      className="v8-feature v8-sheet v9-vivid-feature"
      data-context={context}
      data-motion={motionReduced || trainingActive ? 'off' : 'on'}
    >
      {children}
    </section>
  );
}
export function NavIcon(props: P.NavIconProps) {
  return (
    <span className="v9-vivid-nav" data-selected={props.selected}>
      <Base.NavIcon {...props} />
    </span>
  );
}
export const vividSlots = {
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
