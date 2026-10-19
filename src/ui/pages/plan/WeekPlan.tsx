import type { ReactNode } from 'react';
import type { EnginePlan } from '../../../engine/contracts';
import type { PlanVersion, SessionTemplate } from '../../../domain/v8/contracts';
import { engineDisplayNotices } from '../../../application/engine-presentation';
import { planWeekDays, regionLabels, sessionNames, startDateLabel, weekSchedule, weekdayLabel, weekdays, type Weekday } from '../../../application/plan-presentation';
import { startDateCopy } from '../../../i18n/features/plan/start-date';
import { planViewCopy, effortWords } from '../../../i18n/features/plan/view';
import { targetText } from '../../components/ExerciseTargets';
import { equipmentLabel } from '../../../catalog/taxonomy';
import { fill } from '../../../i18n/features/onboarding/entry';
import { Card, PrimaryButton, WeekStrip, Yaya } from '../../components/kit';
import './plan.css';
import './week-plan.css';

type PlanShape = Pick<PlanVersion, 'weeklyTarget' | 'preferredDays' | 'templates'>;

/** Session name map plus per-day schedule, shared by draft, plan and home. */
export function usePlanView(plan: PlanShape, locale: 'zh' | 'en') {
  const names = sessionNames(plan.templates, locale), schedule = weekSchedule(plan);
  const byId = new Map(plan.templates.map(template => [template.id, template]));
  return { names, schedule, byId, name: (template: Pick<SessionTemplate, 'id'>) => names.get(template.id) ?? '' };
}

export interface WeekPlanProps {
  plan: PlanShape; locale: 'zh' | 'en';
  /** Index (0 = Monday) of today in the user's time zone; highlights the strip. */
  today?: number;
  /** Completed or partial days this week, by weekday. */
  done?: Partial<Record<Weekday, 'done' | 'partial'>>;
  /** Highlighted session (next to train). */
  focusId?: string;
  /** Per-session expandable content (exercise list). */
  details?: (template: SessionTemplate) => ReactNode;
  /** Plan start date and today's local date (YYYY-MM-DD): the calendar then shows real dates from the start. */
  startDate?: string; todayDate?: string;
}
/** One-week calendar: strip of seven days, then one tile per session with weekday, name, minutes and body parts. */
export function WeekPlan({ plan, locale, today, done = {}, focusId, details, startDate, todayDate }: WeekPlanProps) {
  const t = planViewCopy[locale], view = usePlanView(plan, locale), s = startDateCopy[locale];
  const dated = planWeekDays(startDate, todayDate);
  const future = !!dated && !!startDate && !!todayDate && startDate > todayDate;
  const dayNumber = (date: string) => Number(date.slice(8));
  const max = Math.max(1, ...plan.templates.map(template => template.estimatedMinutes));
  // The week shown: plain Monday week, or real dates (first plan week before the start, current week after).
  const shown = dated ?? weekdays.map(day => ({ day, date: '', beforeStart: false }));
  const sessions = shown.flatMap(entry => entry.beforeStart ? [] : view.schedule.sessions.filter(session => session.day === entry.day).map(session => ({ ...session, date: entry.date })));
  const total = sessions.reduce((sum, session) => sum + (view.byId.get(session.templateId)?.estimatedMinutes ?? 0), 0);
  const dayName = (entry: { day: Weekday; date: string }, short = false) => entry.date ? `${weekdayLabel(entry.day, locale, short)}${short ? '' : ` · ${startDateLabel(entry.date, todayDate ?? entry.date, locale, false)}`}` : weekdayLabel(entry.day, locale, short);
  const isToday = (entry: { day: Weekday; date: string }) => entry.date ? entry.date === todayDate : today === weekdays.indexOf(entry.day);
  const days = shown.map(entry => {
    const day = entry.day, session = entry.beforeStart ? undefined : view.schedule.sessions.find(item => item.day === day), template = session && view.byId.get(session.templateId);
    const state = done[day] ?? (template ? 'planned' : 'rest');
    return { key: entry.date || day, label: entry.date ? <>{weekdayLabel(day, locale, true)}<span className="v9-week-date v9-num">{dayNumber(entry.date)}</span></> : weekdayLabel(day, locale, true), state, today: isToday(entry), level: template ? template.estimatedMinutes / max : 0,
      description: `${dayName(entry)} · ${template ? `${view.name(template)} · ${fill(t.minutes, { count: template.estimatedMinutes })}` : t.rest}${done[day] === 'done' ? ` · ${t.done}` : done[day] === 'partial' ? ` · ${t.partial}` : ''}` } as const;
  });
  return <section className="v9-week-plan" aria-label={t.week}>
    <Card variant="raised" padding="lg" className="v9-week-summary">
      <div className="v9-week-summary-head">
        <span className="v9-week-summary-label">{future && startDate ? fill(s.firstWeek, { date: startDateLabel(startDate, todayDate!, locale, false) }) : t.thisWeek}</span>
        <span className="v9-num v9-week-summary-count">{sessions.length}<small>{t.sessionsUnit}</small></span>
        <span className="v9-num v9-week-summary-minutes">{fill(t.totalMinutes, { count: total })}</span>
      </div>
      <WeekStrip label={t.week} days={days} variant="bars" />
      {!view.schedule.chosen && <p className="v9-week-note">{t.suggestedDays}</p>}
    </Card>
    <ol className="v9-session-list">{sessions.map((session, index) => {
      const template = view.byId.get(session.templateId)!, focus = index === Math.max(0, focusId ? sessions.findIndex(item => item.templateId === focusId) : 0);
      const entry = { day: session.day, date: session.date };
      const parts = regionLabels(template, locale);
      // Safety cues (e.g. 扶墙或扶椅) stay visible on the folded row, not only inside the details.
      const cues = [...new Set(template.items.map(item => item.prescription?.safetyCue?.[locale]).filter((cue): cue is string => !!cue))];
      const head = <>
        <span className="v9-session-dot" aria-hidden="true" />
        <span className="v9-session-text"><span className="v9-session-day">{dayName(entry)}{isToday(entry) && !entry.date ? ` · ${t.today}` : ''}</span><span className="v9-session-name">{view.name(template)}</span>
          {parts.length > 0 && <span className="v9-session-parts">{parts.join(' · ')}</span>}
          {cues.length > 0 && <span className="v9-session-cue">{cues.join(' · ')}</span>}</span>
        <span className="v9-num v9-session-minutes">{template.estimatedMinutes}<small>′</small></span>
      </>;
      return <li key={`${session.date || session.day}-${template.id}`} className="v9-session" data-focus={focus ? 'true' : 'false'} data-date={session.date || undefined}>
        {details ? <details><summary aria-label={`${dayName(entry)} ${view.name(template)} · ${fill(t.minutes, { count: template.estimatedMinutes })}${parts.length ? ` · ${parts.join('、')}` : ''}`}>{head}</summary><div className="v9-session-details">{details(template)}</div></details> : <div className="v9-session-row">{head}</div>}
      </li>;
    })}</ol>
  </section>;
}

export function PlanReasons({ reasons, locale }: { reasons: readonly string[]; locale: 'zh' | 'en' }) {
  const t = planViewCopy[locale];
  if (!reasons.length) return null;
  return <Card variant="inset" padding="lg" as="section" className="v9-reasons" aria-labelledby="v9-reasons-title">
    <h2 id="v9-reasons-title">{t.why}</h2><ul>{reasons.map(reason => <li key={reason}>{reason}</li>)}</ul>
  </Card>;
}

const isEnvironmentNotice = (code: string) => code.startsWith('engine.copy.environment_');
/** Stop-level safety notices stay on top (unchanged); everything else becomes one gentle tip at the bottom, the rest folded. */
export function splitNotices(plan: Pick<EnginePlan, 'notices'> & Partial<Pick<EnginePlan, 'gates'>> | undefined) {
  const all = plan ? engineDisplayNotices(plan) : [];
  const stops = all.filter(notice => notice.severity === 'stop'), others = all.filter(notice => notice.severity !== 'stop');
  // An actionable environment notice (it opens the training-space settings) is the one shown first.
  const rest = [...others.filter(notice => isEnvironmentNotice(notice.code)), ...others.filter(notice => !isEnvironmentNotice(notice.code))];
  return { stops, tip: rest[0], more: rest.slice(1), all };
}
export function PlanStops({ plan, locale }: { plan?: Pick<EnginePlan, 'notices'> & Partial<Pick<EnginePlan, 'gates'>>; locale: 'zh' | 'en' }) {
  const { stops } = splitNotices(plan);
  return <>{stops.map((notice, index) => <Card key={`${notice.code}:${index}`} variant="flat" padding="md" className="v9-plan-stop" role="alert">{notice.message[locale]}</Card>)}</>;
}
export function PlanTip({ plan, locale, onEditEnvironment }: { plan?: Pick<EnginePlan, 'notices'> & Partial<Pick<EnginePlan, 'gates'>>; locale: 'zh' | 'en'; onEditEnvironment?: () => void }) {
  const t = planViewCopy[locale], { tip, more } = splitNotices(plan);
  if (!tip) return null;
  const line = (notice: typeof tip) => isEnvironmentNotice(notice.code) && onEditEnvironment
    ? <PrimaryButton tone="text" size="sm" className="v9-plan-tip-link" onClick={onEditEnvironment}>{notice.message[locale]}</PrimaryButton> : notice.message[locale];
  return <Card variant="raised" padding="md" as="aside" className="v9-plan-tip" aria-label={t.tip}>
    <Yaya pose="think" size={48} alt="" />
    <div className="v9-plan-tip-text"><strong>{t.tip}</strong><p role="status">{line(tip)}</p>
      {more.length > 0 && <details><summary>{fill(t.moreTips, { count: more.length })}</summary><ul>{more.map((notice, index) => <li key={`${notice.code}:${index}`}>{line(notice)}</li>)}</ul></details>}
    </div>
  </Card>;
}

/** Exercise rows of one session; tapping opens the read-only guide. Plain words only (no RIR, no internal labels). */
export function SessionItems({ template, locale, name, onExercise, hideDistance, actions }: { template: SessionTemplate; locale: 'zh' | 'en'; name: (id: string) => string; onExercise?: (exerciseId: string, index: number, trigger: HTMLElement) => void; hideDistance?: (exerciseId: string) => boolean;
  /** Optional tools under each row (动作怎么做 / 换动作); each opens its own sheet. */
  actions?: (item: SessionTemplate['items'][number], index: number) => ReactNode }) {
  const t = planViewCopy[locale];
  return <ul className="v9-items">{template.items.map((item, index) => {
    const strength = item.prescription && ['main', 'accessory'].includes(item.prescription.block);
    const note = [item.prescription?.loadDescription?.[locale], item.prescription?.safetyCue?.[locale], strength ? effortWords(item.prescription?.rir, locale) : undefined].filter(Boolean).join(' · ');
    const body = <><span className="v9-item-name">{name(item.exerciseId)}</span>
      <span className="v9-item-target v9-num">{fill(t.sets, { count: item.sets })} · {targetText(item.target, locale, hideDistance?.(item.exerciseId))}</span>
      <span className="v9-item-equipment">{equipmentLabel(item.equipment, locale)}</span>
      {note && <span className="v9-item-note">{note}</span>}</>;
    return <li key={`${item.exerciseId}-${index}`}>{onExercise ? <button type="button" className="v9-item v8-press" onClick={event => onExercise(item.exerciseId, index, event.currentTarget)}>{body}</button> : <div className="v9-item">{body}</div>}
      {actions && <div className="v9-item-actions">{actions(item, index)}</div>}</li>;
  })}</ul>;
}
