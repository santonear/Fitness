import {durationText} from '../../components/ExerciseTargets';
import {engineDisplayNotices} from '../../../application/engine-presentation';
import {EnginePlanNotices} from '../../components/EnginePlanNotices';
import type {EnginePlan} from '../../../engine/contracts';
import {templateLabel} from '../../../i18n/features/plan/labels';
import { planLifecycleCopy } from '../../../i18n/features/plan/lifecycle';
import type { CoachResponse } from '../../../coach/contracts';
import { equipmentLabel } from '../../../catalog/taxonomy';
import {EXERCISE_IDS} from '../../../catalog/exercise-ids';
import type { V8Locale } from '../../../i18n/namespaces.contract';
import type { ThemeSlots } from '../../../themes/contract';
import { Button } from '../../components/common';
import { useRef, useState } from 'react';
import { ExerciseGuidePanel } from '../../components/ExerciseGuide';
import guideZh from '../../../i18n/features/training/guide.zh.json';
import guideEn from '../../../i18n/features/training/guide.en.json';
import zh from '../../../i18n/features/onboarding/zh.json';
import en from '../../../i18n/features/onboarding/en.json';
import './onboarding.css';

export type OnboardingProposal = Extract<CoachResponse, { type: 'plan_proposal' }>;
export interface PlanDraftPageProps {
  locale: V8Locale; candidate: OnboardingProposal & {profile?:{place?:string};enginePlan?:EnginePlan}; basic?: boolean; busy?: boolean; error?: string;
  slots: Pick<ThemeSlots, 'BrandMark' | 'AiLine'>;
  exerciseText: (exerciseId: string) => { name: string; instructions: string };
  /** Parent must revalidate candidate identity, version and restore generation before writing. */
  onConfirm: (candidate: OnboardingProposal) => void; onDiscuss: () => void; onDiscard?: () => void; onEditCautions?: () => void;
}
export function PlanDraftPage({ locale, candidate, basic = false, busy = false, error, slots, exerciseText, onConfirm, onDiscuss, onDiscard, onEditCautions }: PlanDraftPageProps) {
  const t = locale === 'zh' ? zh : en, plan = candidate.proposal;
  const guideCopy=locale==='zh'?guideZh:guideEn;
  const [detail,setDetail]=useState<string>(),trigger=useRef<HTMLElement|null>(null);
  const count = (text: string, value: number) => text.replace('{count}', String(value));
  return <main className="v8-onboarding" lang={locale} aria-busy={busy}>
    <header><slots.BrandMark label={t.brand} />{basic && <span>{t.basic}</span>}</header>
    <section className="v8-onboarding-conversation">
      <slots.AiLine><h1>{t.draft}</h1></slots.AiLine>
      {basic && <p>{t.basicHint}</p>}{candidate.enginePlan&&<EnginePlanNotices plan={candidate.enginePlan} locale={locale}/>}
      <p>{plan.goalText}</p><p>{count(t.weekly, plan.weeklyTarget)}</p>
      {plan.templates.map(template => <section key={template.id} className="v8-draft-template"><h2>{templateLabel(template,locale)}</h2><p>{count(t.minutes, template.estimatedMinutes)}</p>
        {template.items.map((item, index) => { const text = exerciseText(item.exerciseId), target = item.target; return <button type="button" className="v8-draft-exercise" key={`${item.exerciseId}-${index}`} onClick={event=>{trigger.current=event.currentTarget;setDetail(item.exerciseId);}}><strong>{text.name}</strong><span>{count(t.sets, item.sets)}</span>
          <span>{equipmentLabel(item.equipment, locale)}</span><span>{'reps' in target && count(t.reps, target.reps)}{'loadGrams' in target && ` · ${target.loadGrams>0?count(t.kg, target.loadGrams / 1000):item.prescription?.loadDescription?.[locale]??guideCopy.chooseLoad}`}{'durationSeconds' in target && durationText(target.durationSeconds,locale)}{'distanceMeters' in target && target.distanceMeters !== undefined && !(candidate.profile?.place==='home'&&item.exerciseId===EXERCISE_IDS.walking) && ` · ${count(t.meters, target.distanceMeters)}`}</span>
          {item.prescription?.safetyCue&&<span>{[item.prescription.loadDescription?.[locale],item.prescription.safetyCue[locale]].filter(Boolean).join(' · ')}</span>}
        </button>; })}
      </section>)}
      {onEditCautions&&<aside><p>{t.safetyExcluded}</p><Button onClick={onEditCautions}>{t.editCautions}</Button></aside>}
      <section><h2>{t.why}</h2><ul>{[...new Set(plan.reasons)].filter(reason=>!candidate.enginePlan||!engineDisplayNotices(candidate.enginePlan!).some(notice=>notice.message[locale]===reason||reason===engineDisplayNotices(candidate.enginePlan!).map(notice=>notice.message[locale]).join(' '))).map((reason, i) => <li key={i}>{reason}</li>)}</ul></section>
      {error && <p role="alert">{error}</p>}
      <footer className="v8-draft-actions"><Button variant="primary" disabled={busy || !plan.templates.length} onClick={() => { if (!busy && plan.templates.length) onConfirm(candidate); }}>{busy ? t.saving : t.accept}</Button><Button disabled={busy} onClick={onDiscuss}>{t.change}</Button>{onDiscard&&<Button disabled={busy} onClick={onDiscard}>{planLifecycleCopy[locale].discard}</Button>}</footer>
    </section>
    <ExerciseGuidePanel id={detail} locale={locale} open={!!detail} onClose={()=>setDetail(undefined)} triggerRef={trigger}/>
  </main>;
}
