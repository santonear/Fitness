import {BodyConversation} from './BodyConversation';
import {bodyCopy} from '../../../i18n/features/onboarding/body';
import {bodyComplete,type BodyValues} from '../../../domain/body-profile';
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
  placeEquipmentText: string; body?: BodyValues; bodyText?: string;
  safetyAnswered?: boolean;
};
export interface OnboardingPageProps {
  locale: V8Locale; step: 0 | 1 | 2 | 3 | 4; bodyEnabled?: boolean; answers: OnboardingAnswers;
  slots: Pick<ThemeSlots, 'BrandMark' | 'AiLine' | 'Suggestions'>;
  mode: 'ai' | 'basic'; busy?: boolean; error?: string;
  onChange: (answers: OnboardingAnswers) => void; onStep: (step: 0 | 1 | 2 | 3 | 4) => void;
  /** Explicit user intent only; this component never sends or persists data. */
  onGenerate: (answers: OnboardingAnswers) => void; onManual: () => void;
}
const fields = ['goalText', 'scheduleOriginalText', 'placeEquipmentText'] as const;
export function OnboardingPage({ locale, step, answers, slots, mode, bodyEnabled = false, busy = false, error, onChange, onStep, onGenerate, onManual }: OnboardingPageProps) {
  const t = locale === 'zh' ? zh : en, bt=bodyCopy[locale],bodyStep=bodyEnabled&&step===1,questionStep=bodyEnabled&&step>1?step-1:step,lastStep=bodyEnabled?4:3;
  const id = useId(), heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const complete = fields.every(field => answers[field].trim().length > 0)&&(!bodyEnabled||bodyComplete(answers.body??{}));
  const question = bodyStep?bt.title:questionStep < 3 ? t.questions[questionStep] : t.safety;
  const key = fields[Math.min(questionStep, 2)];
  const updateText = (text: string) => onChange({ ...answers, [key]: text });
  return <main className="v8-onboarding" lang={locale} aria-busy={busy}>
    <header><slots.BrandMark label={t.brand} /><span className="v8-onboarding-progress" aria-label={`${step + 1} / ${lastStep+1}`}>{step + 1} / {lastStep+1}</span></header>
    <section className="v8-onboarding-conversation">
      {step === 1 && <p className="v8-onboarding-recap">{bodyEnabled?bt.goal.replace('{goal}',answers.goalText):answers.goalText}</p>}
      <slots.AiLine><h1 ref={heading} tabIndex={-1}>{question}</h1></slots.AiLine>
      {bodyStep ? <><p>{bt.why}</p><BodyConversation locale={locale} values={answers.body??{}} text={answers.bodyText??''} onChange={(body,bodyText)=>onChange({...answers,body,...(bodyText!==undefined?{bodyText}:{})})} busy={busy}/></> : questionStep < 3 ? <>
        <label htmlFor={id}>{t.answer}</label>
        <textarea id={id} value={answers[key]} disabled={busy} maxLength={8000} onChange={event => updateText(event.target.value)} rows={3} />
        <slots.Suggestions label={t.suggestions} options={t.answers[questionStep].map((label, i) => ({ id: String(i), label }))} disabled={busy} onSelect={value => { const text = t.answers[questionStep][Number(value)]; if (text !== undefined) updateText(text); }} />
      </> : <>
        <label className="v8-onboarding-adult"><input type="checkbox" checked={answers.adultConfirmed} disabled={busy || bodyEnabled&&answers.body?.age!==undefined&&answers.body.age<18} onChange={event => onChange({ ...answers, adultConfirmed: event.target.checked })} />{t.adult}</label>
        <fieldset disabled={busy}><legend>{t.cautions}</legend><div className="v8-onboarding-choices">
          <Chip selected={answers.safetyAnswered !== false && answers.cautions.length === 0} disabled={busy} onClick={() => onChange({ ...answers, cautions: [], safetyAnswered: true })}>{t.parts.none}</Chip>
          {(['knee', 'back', 'shoulder', 'wrist', 'other'] as const).map(part => <Chip key={part} selected={answers.cautions.includes(part)} disabled={busy} onClick={() => onChange({ ...answers, safetyAnswered: true, cautions: answers.cautions.includes(part) ? answers.cautions.filter(value => value !== part) : [...answers.cautions, part] })}>{t.parts[part]}</Chip>)}
        </div></fieldset>
        {!answers.adultConfirmed && <p>{t.minor}</p>}
        {mode === 'ai' ? <details><summary>{t.consent}</summary><dl>{[answers.goalText, answers.scheduleOriginalText, answers.placeEquipmentText, answers.adultConfirmed ? t.adult : '—', answers.cautions.length ? answers.cautions.map(part => t.parts[part]).join(' / ') : t.parts.none].map((value, i) => <div key={t.fields[i]}><dt>{t.fields[i]}</dt><dd>{value}</dd></div>)}</dl></details> : <p>{t.basic} · {t.basicHint}</p>}
      </>}
      {busy && <p role="status">{mode === 'ai' ? t.aiWorking : t.working}</p>}
      {error && <p role="alert">{error}</p>}
      <footer>
        {step > 0 && <Button disabled={busy} onClick={() => onStep((step - 1) as 0 | 1 | 2 | 3)}>{t.back}</Button>}
        {step < lastStep ? <Button variant="primary" disabled={busy || (bodyStep?!bodyComplete(answers.body??{}):!answers[key].trim())} onClick={() => onStep((step + 1) as 1 | 2 | 3 | 4)}>{t.next}</Button> : <Button variant="primary" disabled={busy || !complete || !answers.adultConfirmed || answers.safetyAnswered === false} onClick={() => { if (complete && answers.adultConfirmed && answers.safetyAnswered !== false && !busy) onGenerate(answers); }}>{busy ? t.working : t.generate}</Button>}
      </footer>
      {step === lastStep && <Button disabled={busy} onClick={onManual}>{t.manual}</Button>}
    </section>
  </main>;
}
