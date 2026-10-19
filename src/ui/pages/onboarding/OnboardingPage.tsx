import type {EngineProfileFields} from '../../../application/engine-profile';
import {BodyConversation} from './BodyConversation';
import {bodyCopy} from '../../../i18n/features/onboarding/body';
import {bodyComplete,type BodyValues} from '../../../domain/body-profile';
import { useId, useState } from 'react';
import type { CoachProfile } from '../../../domain/v8/contracts';
import type { V8Locale } from '../../../i18n/namespaces.contract';
import type { ThemeSlots } from '../../../themes/contract';
import zh from '../../../i18n/features/onboarding/zh.json';
import en from '../../../i18n/features/onboarding/en.json';
import { entryCopy, fill } from '../../../i18n/features/onboarding/entry';
import { BigChoice, ChoiceChip, PrimaryButton } from '../../components/kit';
import { OnboardingFrame } from './OnboardingFrame';
import { HealthCheckWizard } from './HealthCheckWizard';
import { TrainingCalendar } from '../../components/TrainingCalendar';
import { StartTimeField } from '../../components/StartTimeField';
import { trainingDaysCopy } from '../../../i18n/features/plan/training-days';
import { weeklyTargetFromDates } from '../../../application/training-dates';
import { presetIn } from '../../../application/preset-text';
import './onboarding.css';

/** Uninterpreted answers. The integration layer resolves them before any model request. */
export type OnboardingAnswers = Pick<CoachProfile, 'goalText' | 'scheduleOriginalText' | 'adultConfirmed' | 'cautions' | 'cautionNote'> & EngineProfileFields & {
  placeEquipmentText: string; body?: BodyValues; bodyText?: string;
  safetyAnswered?: boolean;
  /** 芽芽's AI-or-local question; undefined until answered (only asked when AI exists here). */
  planMode?: 'ai' | 'local';
  /** Training days picked on the calendar (sorted local dates, 1–30). */
  trainingDates?: string[];
  /** Planned start time of day, HH:MM. */
  startTime?: string;
};
export interface OnboardingPageProps {
  engineEnabled?:boolean; locale: V8Locale; step: 0 | 1 | 2 | 3 | 4; bodyEnabled?: boolean; answers: OnboardingAnswers;
  slots?: Partial<Pick<ThemeSlots, 'BrandMark' | 'AiLine' | 'Suggestions'>>;
  mode: 'ai' | 'basic'; busy?: boolean; error?: string;
  onChange: (answers: OnboardingAnswers) => void; onStep: (step: 0 | 1 | 2 | 3 | 4) => void;
  /** Explicit user intent only; this component never sends or persists data. */
  onGenerate: (answers: OnboardingAnswers) => void; onManual: () => void;
  /** Leaves the first question (back to the welcome screen). */
  onExit?: () => void;
  /** Health-check screen to open first (for example `ready`). */
  initialSafetyScreen?: string;
  /** AI planning exists in this deployment (asks AI-or-local before generating). */
  aiAvailable?: boolean;
  /** Today's local date (YYYY-MM-DD) for the training-day calendar. */
  today?: string;
  /** 回到今天: the host clears unsaved answers (after confirming) and opens 今天. */
  onHome?: () => void;
}
const fields = ['goalText', 'scheduleOriginalText', 'placeEquipmentText'] as const;
export function cautionsFromGoal(goal:string):CoachProfile['cautions'] {
  return /(?:膝(?:盖|关节)|knee).{0,12}(?:伤|疼|痛|不适|受过伤|injur|pain|hurt)|(?:伤|疼|痛|不适|injur|pain|hurt).{0,12}(?:膝(?:盖|关节)|knee)/i.test(goal)?['knee']:[];
}
const minuteOptions = [20, 30, 45, 60] as const;
/** Reads back a schedule the calendar and chips composed; anything else stays the user's own words. */
export function parseComposedSchedule(text: string): { weekly?: number; minutes?: number } | undefined {
  const match = text.match(/^每周 (\d) 次，每次 (\d+) 分钟(?:，共 \d+ 天)?$/) ?? text.match(/^(\d) times a week, (\d+) minutes each time(?:, \d+ days in total)?$/);
  return match ? { weekly: Number(match[1]), minutes: Number(match[2]) } : undefined;
}

/** Free text stays possible behind “自己写一句”; the tapped option is the stored answer, never a placeholder. */
function CustomAnswer({ locale, value, onChange, disabled, open, onToggle }: { locale: V8Locale; value: string; onChange: (text: string) => void; disabled: boolean; open: boolean; onToggle: () => void }) {
  const t = entryCopy[locale], id = useId();
  return <div className="v9-custom">
    <ChoiceChip size="sm" selected={open} aria-expanded={open} disabled={disabled} onClick={onToggle}>{open ? t.customHide : t.custom}</ChoiceChip>
    {open && <div className="v9-field"><label htmlFor={id}>{t.answer}</label><textarea id={id} value={value} disabled={disabled} maxLength={8000} rows={3} onChange={event => onChange(event.target.value)} /></div>}
  </div>;
}

export function OnboardingPage({ engineEnabled=false, locale, step, answers, mode, bodyEnabled = false, busy = false, error, onChange, onStep, onGenerate, onManual, onExit, initialSafetyScreen, aiAvailable = false, today, onHome }: OnboardingPageProps) {
  const legacy = locale === 'zh' ? zh : en, t = entryCopy[locale], bt=bodyCopy[locale], d = trainingDaysCopy[locale];
  const [dayNotice, setDayNotice] = useState('');
  const bodyStep=bodyEnabled&&step===1,questionStep=bodyEnabled&&step>1?step-1:step,lastStep=bodyEnabled?4:3,total=lastStep+1;
  const key = fields[Math.min(questionStep, 2)];
  const options = key === 'goalText' ? legacy.answers[0] as readonly string[] : key === 'placeEquipmentText' ? t.place.options as readonly string[] : [];
  const composed = parseComposedSchedule(answers.scheduleOriginalText);
  const [customOpen, setCustomOpen] = useState<Record<string, boolean>>({});
  const [schedule, setSchedule] = useState<{ weekly?: number; minutes?: number }>(composed ?? {});
  const value = answers[key];
  // A preset tapped in the other language is still that preset (stored text is kept until the user changes it).
  const shown = key === 'scheduleOriginalText' ? value : presetIn(value, locale) ?? value;
  const custom = customOpen[key] ?? (value.trim().length > 0 && (key === 'scheduleOriginalText' ? !composed : !options.includes(shown)));
  const engineComplete=!engineEnabled||!!answers.healthStorageConsent&&!!answers.screening?.completedAt&&!!answers.population&&!!answers.birthYearMonth;
  const complete = engineComplete&&fields.every(field => answers[field].trim().length > 0)&&(!bodyEnabled||bodyComplete(answers.body??{}));
  const updateText = (text: string) => onChange({ ...answers, [key]: text });
  const advance=()=>{if(step===0&&answers.safetyAnswered!==true){const inferred=cautionsFromGoal(answers.goalText);if(inferred.length){onChange({...answers,cautions:[...new Set([...answers.cautions,...inferred])]});}}onStep((step+1) as 1|2|3|4)};
  const back = () => { if (step > 0) onStep((step - 1) as 0 | 1 | 2 | 3); else onExit?.(); };
  const sendFields:[string,string|number][]=[
    [legacy.fields[0],answers.goalText],[legacy.fields[1],answers.scheduleOriginalText],[legacy.fields[2],answers.placeEquipmentText],
    ...((['biologicalSex','age','heightCm','weightKg','waistCm'] as const).filter(field=>answers.body?.[field]!==undefined).map(field=>[bt.labels[field],String(answers.body?.[field])]) as [string,string][]),
    [legacy.fields[3],answers.cautions.length?answers.cautions.map(part=>legacy.parts[part]).join(' / '):legacy.parts.none]
  ];
  const fieldStep = (field: typeof fields[number]) => (bodyEnabled ? 1 : 0) + fields.indexOf(field) + (bodyEnabled && field === 'goalText' ? -1 : 0);
  const missingOuter = [
    ...fields.filter(field => !answers[field].trim()).map(field => ({ key: field === 'goalText' ? 'goal' as const : field === 'scheduleOriginalText' ? 'schedule' as const : 'place' as const, step: fieldStep(field) })),
    ...(bodyEnabled && !bodyComplete(answers.body ?? {}) ? [{ key: 'body' as const, step: 1 }] : []),
  ];
  if (step === lastStep) return <HealthCheckWizard locale={locale} answers={answers} engineEnabled={engineEnabled} bodyEnabled={bodyEnabled} mode={mode} busy={busy} error={error}
    aiAvailable={aiAvailable} missingOuter={missingOuter} onOuterStep={next => onStep(next as 0 | 1 | 2 | 3 | 4)}
    step={step + 1} total={total} complete={complete} sendFields={sendFields} onChange={onChange} onExit={() => onStep((step - 1) as 0 | 1 | 2 | 3)} onGenerate={() => onGenerate(answers)} onManual={onManual} initialScreen={initialSafetyScreen} onHome={onHome} />;
  const next = <PrimaryButton disabled={busy || (bodyStep ? !bodyComplete(answers.body ?? {}) : !value.trim())} onClick={advance}>{t.next}</PrimaryButton>;
  const frame = { locale, step: step + 1, total, screenKey: `step-${step}`, onBack: step > 0 || onExit ? back : undefined, backDisabled: busy, busy, onHome, homeDirty: fields.some(field => answers[field].trim().length > 0) || !!answers.trainingDates?.length, footer: <>{error && <p role="alert">{error}</p>}{next}</> };
  if (bodyStep) return <OnboardingFrame {...frame} title={bt.title} sub={bt.why}>
    <BodyConversation locale={locale} values={answers.body??{}} text={answers.bodyText??''} onChange={(body,bodyText)=>onChange({...answers,body,...(bodyText!==undefined?{bodyText}:{})})} busy={busy}/>
  </OnboardingFrame>;
  if (key === 'scheduleOriginalText') {
    // Bo 2026-10-19: pick 1–30 training days on a calendar (tap or drag), how long each time, then the start time.
    const dates = custom ? [] : answers.trainingDates ?? [];
    const minutes = custom ? undefined : schedule.minutes ?? composed?.minutes;
    const compose = (nextDates: string[], nextMinutes: number | undefined, extra: Partial<OnboardingAnswers> = {}) => {
      const text = nextDates.length && nextMinutes ? fill(d.text, { weekly: weeklyTargetFromDates(nextDates), minutes: nextMinutes, count: nextDates.length }) : '';
      const { trainingDates: _dates, ...rest } = answers;
      onChange({ ...rest, ...extra, ...(nextDates.length ? { trainingDates: nextDates } : {}), scheduleOriginalText: text });
    };
    const pickMinutes = (count: number) => { setSchedule({ minutes: count }); setCustomOpen(open => ({ ...open, [key]: false })); compose(dates, count); };
    return <OnboardingFrame {...frame} title={t.schedule.title} sub={d.sub}>
      <div className="v9-groups">
        {!custom && <TrainingCalendar locale={locale} today={today ?? new Date().toISOString().slice(0, 10)} value={dates} disabled={busy}
          onChange={(next, notice) => { setDayNotice(notice); setCustomOpen(open => ({ ...open, [key]: false })); compose(next, minutes); }} />}
        {!custom && dayNotice && <p className="v9-days-notice" role="status">{dayNotice}</p>}
        {!custom && <div className="v9-group"><span className="v9-group-label">{d.minutes}</span><div className="v9-chip-row" role="group" aria-label={d.minutes}>
          {minuteOptions.map(count => <ChoiceChip key={count} selected={minutes === count} disabled={busy} onClick={() => pickMinutes(count)}>{fill(t.schedule.sessionOption, { count })}</ChoiceChip>)}</div></div>}
        {!custom && dates.length > 0 && <StartTimeField locale={locale} value={answers.startTime} disabled={busy} onChange={startTime => { const { startTime: _old, ...rest } = answers; onChange(startTime ? { ...rest, startTime } : rest); }} />}
        <CustomAnswer locale={locale} value={custom ? value : ''} disabled={busy} open={custom} onChange={updateText}
          onToggle={() => { const open = !custom; setCustomOpen(state => ({ ...state, [key]: open })); setDayNotice(''); if (open) { setSchedule({}); const { trainingDates: _dates, startTime: _time, ...rest } = answers; onChange({ ...rest, scheduleOriginalText: '' }); } }} />
      </div>
    </OnboardingFrame>;
  }
  const copy = key === 'goalText' ? t.goal : t.place;
  return <OnboardingFrame {...frame} title={copy.title} sub={copy.sub}>
    <div className="v9-choices" role="radiogroup" aria-label={copy.title}>
      {options.map(option => <BigChoice key={option} label={option} selected={!custom && shown === option} disabled={busy} onClick={() => { setCustomOpen(open => ({ ...open, [key]: false })); updateText(option); }} />)}
    </div>
    <CustomAnswer locale={locale} value={custom ? value : ''} disabled={busy} open={custom} onChange={updateText}
      onToggle={() => { const open = !custom; setCustomOpen(state => ({ ...state, [key]: open })); if (open && options.includes(shown)) updateText(''); }} />
  </OnboardingFrame>;
}
