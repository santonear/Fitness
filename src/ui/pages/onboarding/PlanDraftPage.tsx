import type { CoachResponse } from '../../../coach/contracts';
import { EQUIPMENT, equipmentLabel } from '../../../catalog/taxonomy';
import type { V8Locale } from '../../../i18n/namespaces.contract';
import type { ThemeSlots } from '../../../themes/contract';
import { Button } from '../../components/common';
import zh from '../../../i18n/features/onboarding/zh.json';
import en from '../../../i18n/features/onboarding/en.json';
import './onboarding.css';

export type OnboardingProposal = Extract<CoachResponse, { type: 'plan_proposal' }>;
export interface PlanDraftPageProps {
  locale: V8Locale; candidate: OnboardingProposal; basic?: boolean; busy?: boolean; error?: string;
  slots: Pick<ThemeSlots, 'BrandMark' | 'AiLine'>;
  exerciseText: (exerciseId: string) => { name: string; instructions: string };
  /** Parent must revalidate candidate identity, version and restore generation before writing. */
  onConfirm: (candidate: OnboardingProposal) => void; onDiscuss: () => void;
}
export function PlanDraftPage({ locale, candidate, basic = false, busy = false, error, slots, exerciseText, onConfirm, onDiscuss }: PlanDraftPageProps) {
  const t = locale === 'zh' ? zh : en, plan = candidate.proposal;
  const count = (text: string, value: number) => text.replace('{count}', String(value));
  return <main className="v8-onboarding" lang={locale} aria-busy={busy}>
    <header><slots.BrandMark label={t.brand} />{basic && <span>{t.basic}</span>}</header>
    <section className="v8-onboarding-conversation">
      <slots.AiLine><h1>{t.draft}</h1></slots.AiLine>
      <p>{plan.goalText}</p><p>{count(t.weekly, plan.weeklyTarget)}</p>
      {plan.templates.map(template => <section key={template.id} className="v8-draft-template"><h2>{template.name}</h2><p>{count(t.minutes, template.estimatedMinutes)}</p>
        {template.items.map((item, index) => { const text = exerciseText(item.exerciseId), target = item.target; return <details className="v8-draft-exercise" key={`${item.exerciseId}-${index}`}><summary>{text.name} · {count(t.sets, item.sets)}</summary><div>
          <p>{(EQUIPMENT as readonly string[]).includes(item.equipment) ? equipmentLabel(item.equipment, locale) : item.equipment}</p><p>{'reps' in target && count(t.reps, target.reps)}{'loadGrams' in target && ` · ${count(t.kg, target.loadGrams / 1000)}`}{'durationSeconds' in target && count(t.seconds, target.durationSeconds)}{'distanceMeters' in target && target.distanceMeters !== undefined && ` · ${count(t.meters, target.distanceMeters)}`}</p><p>{text.instructions}</p>
        </div></details>; })}
      </section>)}
      <section><h2>{t.why}</h2><ul>{plan.reasons.map((reason, i) => <li key={i}>{reason}</li>)}</ul></section>
      {error && <p role="alert">{error}</p>}
      <footer><Button variant="primary" disabled={busy || !plan.templates.length} onClick={() => { if (!busy && plan.templates.length) onConfirm(candidate); }}>{busy ? t.saving : t.accept}</Button><Button disabled={busy} onClick={onDiscuss}>{t.change}</Button></footer>
    </section>
  </main>;
}
