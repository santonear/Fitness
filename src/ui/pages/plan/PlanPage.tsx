import { useState, type ReactNode } from 'react';
import {templateLabel,estimatedDurationLabel} from '../../../i18n/features/plan/labels';
import type { PlannedItem, PlanVersion, WorkoutRecord } from '../../../domain/v8/contracts';
import { planMessages, type PlanLanguage } from '../../../i18n/features/plan/messages';
import { PrimaryButton, SegmentedTabs } from '../../components/kit';
import { MonthPlan } from './MonthPlan';
import { planCalendarCopy } from '../../../i18n/features/plan/calendar';
import { WeekPlan, PlanReasons, SessionItems, type WeekPlanProps } from './WeekPlan';
import { planViewCopy } from '../../../i18n/features/plan/view';
import { planReasons, startDateLabel } from '../../../application/plan-presentation';
import { startDateCopy } from '../../../i18n/features/plan/start-date';
import './plan.css';
import guideZh from '../../../i18n/features/training/guide.zh.json';
import guideEn from '../../../i18n/features/training/guide.en.json';
import {EXERCISE_IDS} from '../../../catalog/exercise-ids';
import {durationText} from '../../components/ExerciseTargets';

export interface PlanPageProps {
  version: PlanVersion;
  /** Supplied by the host from its selected plan; never inferred from version numbers. */
  currentVersionId: string;
  language: PlanLanguage;
  exerciseName: (exerciseId: string) => string;
  onVersions: () => void;
  onExercises: () => void;
  /** Opens read-only details; any proposed edits require the host's separate confirmation flow. */
  onExercise: (version: PlanVersion, templateId: string, itemIndex: number, trigger?: HTMLElement) => void;
  onDiscuss?: (version: PlanVersion) => void;
}

export function itemTarget(item: PlannedItem, language: PlanLanguage, hideDistance = false): string {
  const t = planMessages[language], target = item.target;
  const value = target.metricType === 'reps_load' ? `${t.reps(target.reps)} · ${target.loadGrams>0?t.kg(target.loadGrams / 1000):(language==='zh'?guideZh:guideEn).chooseLoad}`
    : target.metricType === 'reps' ? t.reps(target.reps)
    : target.metricType === 'duration' ? durationText(target.durationSeconds, language)
    : `${durationText(target.durationSeconds, language)}${hideDistance||target.distanceMeters === undefined ? '' : ` · ${t.meters(target.distanceMeters)}`}`;
  const relative=item.prescription?.safetyCue?` · ${[item.prescription.loadDescription?.[language],item.prescription.safetyCue[language]].filter(Boolean).join(' · ')}`:'';
  return `${t.sets(item.sets)} · ${value}${relative}`;
}

export {templateLabel} from '../../../i18n/features/plan/labels';
const dayOrder=['mon','tue','wed','thu','fri','sat','sun'] as const;
export function preferredDaysLabel(days:PlanVersion['preferredDays'],language:PlanLanguage):string{
 if(!days?.length)return '';
 const selected=dayOrder.filter(day=>days.includes(day));
 if(language==='zh'){
  const names:{[K in typeof dayOrder[number]]:string}={mon:'一',tue:'二',wed:'三',thu:'四',fri:'五',sat:'六',sun:'日'};
  return `周${selected.map(day=>names[day]).join('、')}`;
 }
 const names:{[K in typeof dayOrder[number]]:string}={mon:'Mon',tue:'Tue',wed:'Wed',thu:'Thu',fri:'Fri',sat:'Sat',sun:'Sun'};
 return selected.map(day=>names[day]).join('/');
}
export function PlanPage({ version, currentVersionId, language, exerciseName, onVersions, onExercises, onExercise, onDiscuss, today, done, focusId, startDate, todayDate, onChangeStart, changeStartBlocked, exerciseActions, workouts, timeZone }: PlanPageProps & { today?: number; done?: WeekPlanProps['done']; focusId?: string;
  /** Recorded workouts and the user's time zone: enable the month view (计划 › 月). */
  workouts?: readonly WorkoutRecord[]; timeZone?: string;
  /** Plan start date and today's local date; shown with a change button for the current version. */
  startDate?: string; todayDate?: string; onChangeStart?: (trigger: HTMLElement) => void; changeStartBlocked?: string;
  /** Per-exercise tools (动作怎么做 / 换动作) rendered under each session's exercise list. */
  exerciseActions?: (templateId: string, itemIndex: number, exerciseId: string) => ReactNode }) {
  const sd = startDateCopy[language];
  const t = planMessages[language], v = planViewCopy[language], current = version.id === currentVersionId;
  const date = new Intl.DateTimeFormat(language, { year: 'numeric', month: 'long', day: 'numeric' }).format(new Date(version.createdAt));
  const cal = planCalendarCopy[language], [view, setView] = useState<'week' | 'month'>('week');
  const details = (template: PlanVersion['templates'][number]) => <SessionItems template={template} locale={language} name={exerciseName}
    hideDistance={id => id === EXERCISE_IDS.walking && /室内|indoor/i.test(template.name)}
    actions={current && exerciseActions ? (item, index) => exerciseActions(template.id, index, item.exerciseId) : undefined}
    onExercise={(_id, index, element) => onExercise(version, template.id, index, element)} />;
  return <section className="plan-page v9-plan-page" aria-labelledby="plan-title">
    <header className="v9-plan-head">
      <span className="v9-plan-kicker">{t.version(version.versionNumber)} · <time dateTime={version.createdAt}>{date}</time> · {t.origins[version.origin]}{!current && ` · ${t.readOnly}`}</span>
      <h1 id="plan-title" className="v9-display">{v.planTitle}</h1>
      <p className="v9-plan-kicker">{t.goal} · <span>{version.goalText}</span></p>
      {startDate && todayDate && <div className="v9-plan-start"><span>{sd.current} · <strong data-testid="plan-start-date">{startDateLabel(startDate, todayDate, language)}</strong></span>
        {current && onChangeStart && <PrimaryButton tone="text" size="sm" disabled={!!changeStartBlocked} onClick={event => onChangeStart(event.currentTarget)}>{sd.change}</PrimaryButton>}
        {current && changeStartBlocked && <small>{changeStartBlocked}</small>}</div>}
      <dl className="plan-summary v9-plan-rhythm"><dt>{t.rhythm}</dt><dd>{version.preferredDays?.length ? preferredDaysLabel(version.preferredDays, language) : language === 'zh' ? `每周 ${version.weeklyTarget} 次` : `${version.weeklyTarget} times a week`}</dd><dd className="plan-muted">{estimatedDurationLabel(version.templates, language)}</dd></dl>
    </header>
    {workouts && todayDate && timeZone && <SegmentedTabs label={cal.view} value={view} onChange={value => setView(value === 'month' ? 'month' : 'week')} options={[{ value: 'week', label: cal.week }, { value: 'month', label: cal.month }]} />}
    {view === 'month' && workouts && todayDate && timeZone
      ? <MonthPlan plan={version} workouts={workouts} locale={language} todayDate={todayDate} startDate={startDate} timeZone={timeZone} details={details} />
      : <WeekPlan plan={version} locale={language} today={today} done={done} focusId={focusId} startDate={startDate} todayDate={todayDate} details={details} />}
    <PlanReasons reasons={planReasons(version, language)} locale={language} />
    <nav className="v9-plan-tools" aria-label={t.title}><PrimaryButton tone="quiet" size="sm" onClick={onVersions}>{t.history}</PrimaryButton><PrimaryButton tone="quiet" size="sm" onClick={onExercises}>{t.library}</PrimaryButton></nav>
    {current && onDiscuss && <PrimaryButton onClick={() => { if (version.id === currentVersionId) onDiscuss(version); }}>{t.chat}</PrimaryButton>}
  </section>;
}
