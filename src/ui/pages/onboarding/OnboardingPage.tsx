import { useEffect, useId, useRef } from 'react';
import type { CoachProfile } from '../../../domain/v8/contracts';
import type { V8Locale } from '../../../i18n/namespaces.contract';
import type { ThemeSlots } from '../../../themes/contract';
import zh from '../../../i18n/features/onboarding/zh.json';
import en from '../../../i18n/features/onboarding/en.json';
import { Button, Chip } from '../../components/common';
import './onboarding.css';

/** Uninterpreted answers. The integration layer resolves them before any model request. */
export type OnboardingAnswers = Pick<CoachProfile, 'goalText' | 'scheduleOriginalText' | 'adultConfirmed' | 'cautions'> & {
  placeEquipmentText: string;
  safetyAnswered?: boolean;
};
export interface OnboardingPageProps {
  locale: V8Locale; step: 0 | 1 | 2 | 3; answers: OnboardingAnswers;
  slots: Pick<ThemeSlots, 'BrandMark' | 'AiLine' | 'Suggestions'>;
  mode: 'ai' | 'basic'; busy?: boolean; error?: string;
  onChange: (answers: OnboardingAnswers) => void; onStep: (step: 0 | 1 | 2 | 3) => void;
  /** Explicit user intent only; this component never sends or persists data. */
  onGenerate: (answers: OnboardingAnswers) => void; onManual: () => void;
}
const fields = ['goalText', 'scheduleOriginalText', 'placeEquipmentText'] as const;
export function OnboardingPage({ locale, step, answers, slots, mode, busy = false, error, onChange, onStep, onGenerate, onManual }: OnboardingPageProps) {
  const t = locale === 'zh' ? zh : en;
  const id = useId(), heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const complete = fields.every(field => answers[field].trim().length > 0);
  const question = step < 3 ? t.questions[step] : t.safety;
  const key = fields[Math.min(step, 2)];
  const updateText = (text: string) => onChange({ ...answers, [key]: text });
  return <main className="v8-onboarding" lang={locale} aria-busy={busy}>
    <header><slots.BrandMark label={t.brand} /><span className="v8-onboarding-progress" aria-label={`${step + 1} / 4`}>{step + 1} / 4</span></header>
    <section className="v8-onboarding-conversation">
      {step === 1 && <p className="v8-onboarding-recap">{answers.goalText}</p>}
      <slots.AiLine><h1 ref={heading} tabIndex={-1}>{question}</h1></slots.AiLine>
      {step < 3 ? <>
        <label htmlFor={id}>{t.answer}</label>
        <textarea id={id} value={answers[key]} disabled={busy} maxLength={8000} onChange={event => updateText(event.target.value)} rows={3} />
        <slots.Suggestions label={t.suggestions} options={t.answers[step].map((label, i) => ({ id: String(i), label }))} disabled={busy} onSelect={value => { const text = t.answers[step][Number(value)]; if (text !== undefined) updateText(text); }} />
      </> : <>
        <label className="v8-onboarding-adult"><input type="checkbox" checked={answers.adultConfirmed} disabled={busy} onChange={event => onChange({ ...answers, adultConfirmed: event.target.checked })} />{t.adult}</label>
        <fieldset disabled={busy}><legend>{t.cautions}</legend><div className="v8-onboarding-choices">
          <Chip selected={answers.safetyAnswered !== false && answers.cautions.length === 0} disabled={busy} onClick={() => onChange({ ...answers, cautions: [], safetyAnswered: true })}>{t.parts.none}</Chip>
          {(['knee', 'back', 'shoulder', 'wrist', 'other'] as const).map(part => <Chip key={part} selected={answers.cautions.includes(part)} disabled={busy} onClick={() => onChange({ ...answers, safetyAnswered: true, cautions: answers.cautions.includes(part) ? answers.cautions.filter(value => value !== part) : [...answers.cautions, part] })}>{t.parts[part]}</Chip>)}
        </div></fieldset>
        {!answers.adultConfirmed && <p>{t.minor}</p>}
        {mode === 'ai' ? <details><summary>{t.consent}</summary><dl>{[answers.goalText, answers.scheduleOriginalText, answers.placeEquipmentText, answers.adultConfirmed ? t.adult : '—', answers.cautions.length ? answers.cautions.map(part => t.parts[part]).join(' / ') : t.parts.none].map((value, i) => <div key={t.fields[i]}><dt>{t.fields[i]}</dt><dd>{value}</dd></div>)}</dl></details> : <p>{t.basic}</p>}
      </>}
      {error && <p role="alert">{error}</p>}
      <footer>
        {step > 0 && <Button disabled={busy} onClick={() => onStep((step - 1) as 0 | 1 | 2)}>{t.back}</Button>}
        {step < 3 ? <Button variant="primary" disabled={busy || !answers[key].trim()} onClick={() => onStep((step + 1) as 1 | 2 | 3)}>{t.next}</Button> : <Button variant="primary" disabled={busy || !complete || !answers.adultConfirmed || answers.safetyAnswered === false} onClick={() => { if (complete && answers.adultConfirmed && answers.safetyAnswered !== false && !busy) onGenerate(answers); }}>{busy ? t.working : t.generate}</Button>}
      </footer>
      {step === 3 && <Button disabled={busy} onClick={onManual}>{t.manual}</Button>}
    </section>
  </main>;
}
