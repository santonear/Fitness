import type * as Props from '../../contract';
import * as Base from '../../base/slots';
import { GlazedNavIcon } from '../../base/GlazedNavIcon';
import { Button } from '../../../ui/components/common';
import './slots.css';
export function BrandMark({label}: Props.BrandMarkProps){return <span className="v8-brand v8-jingshe-brand">{label}</span>;}
export function WeekProgress(props: Props.WeekProgressProps){return <div className="v8-jingshe-week"><Base.WeekProgress {...props}/></div>;}
export function Suggestions(props: Props.SuggestionsProps){return <div className="v8-jingshe-suggestions"><Base.Suggestions {...props}/></div>;}
export function AiLine(props: Props.AiLineProps){return <div className="v8-jingshe-ai"><Base.AiLine {...props}/></div>;}
export function SetValue(props: Props.SetValueProps){return <div className="v8-jingshe-set"><Base.SetValue {...props}/></div>;}
export function RestClock(props: Props.RestClockProps){return <div className="v8-jingshe-rest"><Base.RestClock {...props}/></div>;}
export function FeatureCard(props: Props.FeatureCardProps){return <div className="v8-jingshe-feature"><Base.FeatureCard {...props}/></div>;}
export function NavIcon(props: Props.NavIconProps){return <GlazedNavIcon {...props} className="v8-jingshe-nav"/>;}
export function StartHero({name,templateId,estimatedMinutes,startLabel,disabled,onStart}: Props.StartHeroProps){return <div className="v8-start v8-jingshe-start" data-template-id={templateId}><h2>{name}</h2><span className="v8-minutes">{estimatedMinutes} min</span><Button variant="primary" disabled={disabled} onClick={onStart}>{startLabel}</Button></div>;}
export const jingsheSlots = {BrandMark,WeekProgress,StartHero,Suggestions,AiLine,SetValue,RestClock,FeatureCard,NavIcon};
