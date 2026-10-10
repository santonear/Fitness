import type * as Props from '../../contract';
import * as Base from '../../base/slots';
import { GlazedNavIcon } from '../../base/GlazedNavIcon';
import { Button } from '../../../ui/components/common';
import './slots.css';
export function BrandMark({label}: Props.BrandMarkProps){return <span className="v8-brand v8-liubai-brand">{label}</span>;}
export function WeekProgress(props: Props.WeekProgressProps){return <div className="v8-liubai-week"><svg className="v8-liubai-ridge" viewBox="0 0 160 24" aria-hidden="true"><path d="M0 22L24 14L42 18L66 4L86 13L111 7L136 17L160 10"/></svg><Base.WeekProgress {...props}/></div>;}
export function Suggestions(props: Props.SuggestionsProps){return <div className="v8-liubai-suggestions"><Base.Suggestions {...props}/></div>;}
export function AiLine(props: Props.AiLineProps){return <div className="v8-liubai-ai"><Base.AiLine {...props}/></div>;}
export function SetValue(props: Props.SetValueProps){return <div className="v8-liubai-set"><Base.SetValue {...props}/></div>;}
export function RestClock(props: Props.RestClockProps){return <div className="v8-liubai-rest"><Base.RestClock {...props}/></div>;}
export function FeatureCard(props: Props.FeatureCardProps){return <div className="v8-liubai-feature"><Base.FeatureCard {...props}/></div>;}
export function NavIcon(props: Props.NavIconProps){return <GlazedNavIcon {...props} className="v8-liubai-nav"/>;}
export function StartHero({name,templateId,estimatedMinutes,startLabel,nextLabel,disabled,onStart}: Props.StartHeroProps){return <div className="v8-start v8-liubai-start" data-template-id={templateId}><h2>{name}</h2>{nextLabel && <span className="v8-next-label">{nextLabel}</span>}<span className="v8-minutes">{estimatedMinutes} min</span><Button variant="primary" disabled={disabled} onClick={onStart}>{startLabel}</Button></div>;}
export const liubaiSlots = {BrandMark,WeekProgress,StartHero,Suggestions,AiLine,SetValue,RestClock,FeatureCard,NavIcon};

