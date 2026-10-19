import {engineDisplayNotices} from '../../../application/engine-presentation';
import {planReasons,weekdayIndex} from '../../../application/plan-presentation';
import type {EnginePlan} from '../../../engine/contracts';
import { planLifecycleCopy } from '../../../i18n/features/plan/lifecycle';
import { planViewCopy } from '../../../i18n/features/plan/view';
import type { CoachResponse } from '../../../coach/contracts';
import {EXERCISE_IDS} from '../../../catalog/exercise-ids';
import type { V8Locale } from '../../../i18n/namespaces.contract';
import type { ThemeSlots } from '../../../themes/contract';
import { useEffect, useRef, useState } from 'react';
import { ExerciseGuidePanel } from '../../components/ExerciseGuide';
import { PrimaryButton } from '../../components/kit';
import { WeekPlan, PlanReasons, PlanStops, PlanTip, SessionItems } from '../plan/WeekPlan';
import './onboarding.css';

export type OnboardingProposal = Extract<CoachResponse, { type: 'plan_proposal' }>;
export interface PlanDraftPageProps {
  locale: V8Locale; candidate: OnboardingProposal & {profile?:{place?:string};enginePlan?:EnginePlan};
  /** Kept for callers; the draft no longer labels local plans (P1 #9/#14). */
  basic?: boolean; busy?: boolean; error?: string;
  slots?: Partial<Pick<ThemeSlots, 'BrandMark' | 'AiLine'>>;
  exerciseText: (exerciseId: string) => { name: string; instructions: string };
  timeZone?: string;
  /** Parent must revalidate candidate identity, version and restore generation before writing. */
  onConfirm: (candidate: OnboardingProposal) => void; onDiscuss: () => void; onDiscard?: () => void; onEditCautions?: () => void;
}
/** Plan draft (V9 plan screen): week calendar, named sessions, why, one tip at the bottom, then confirm. */
export function PlanDraftPage({ locale, candidate, busy = false, error, exerciseText, timeZone, onConfirm, onDiscuss, onDiscard, onEditCautions }: PlanDraftPageProps) {
  const t = planViewCopy[locale], plan = candidate.proposal;
  const [detail,setDetail]=useState<string>(),trigger=useRef<HTMLElement|null>(null),heading=useRef<HTMLHeadingElement>(null);
  useEffect(()=>{heading.current?.focus();},[]);
  const notices=candidate.enginePlan?engineDisplayNotices(candidate.enginePlan).map(notice=>notice.message[locale]):[];
  const stored=[...new Set(plan.reasons)].filter(reason=>!notices.includes(reason)&&reason!==notices.join(' ')&&reason.trim());
  const reasons=stored.length?stored:planReasons(plan,locale);
  const today=weekdayIndex(new Date(),timeZone??Intl.DateTimeFormat().resolvedOptions().timeZone);
  return <main className="v9-plan-screen" lang={locale} aria-busy={busy}>
    <header className="v9-plan-head"><span className="v9-plan-kicker">{plan.goalText}</span><h1 ref={heading} tabIndex={-1} className="v9-display">{t.draftTitle}</h1></header>
    <PlanStops plan={candidate.enginePlan} locale={locale}/>
    <WeekPlan plan={plan} locale={locale} today={today} details={template=><SessionItems template={template} locale={locale} name={id=>exerciseText(id).name}
      hideDistance={id=>candidate.profile?.place==='home'&&id===EXERCISE_IDS.walking}
      onExercise={(id,_index,element)=>{trigger.current=element;setDetail(id);}}/>}/>
    <PlanReasons reasons={reasons} locale={locale}/>
    {onEditCautions&&<p className="v9-plan-line">{t.cautionsExcluded} <PrimaryButton tone="text" size="sm" onClick={onEditCautions}>{t.editCautions}</PrimaryButton></p>}
    <PlanTip plan={candidate.enginePlan} locale={locale} onEditEnvironment={()=>window.location.assign('/settings/engine#environment')}/>
    {error && <p role="alert">{error}</p>}
    <footer className="v9-plan-actions" data-orb-avoid="">
      <PrimaryButton disabled={busy || !plan.templates.length} onClick={() => { if (!busy && plan.templates.length) onConfirm(candidate); }}>{busy ? t.saving : t.accept}</PrimaryButton>
      <PrimaryButton tone="quiet" disabled={busy} onClick={onDiscuss}>{t.discuss}</PrimaryButton>
      {onDiscard&&<PrimaryButton tone="text" size="md" disabled={busy} onClick={onDiscard}>{planLifecycleCopy[locale].discard}</PrimaryButton>}
    </footer>
    <ExerciseGuidePanel id={detail} locale={locale} open={!!detail} onClose={()=>setDetail(undefined)} triggerRef={trigger}/>
  </main>;
}
