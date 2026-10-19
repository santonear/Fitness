import type { ReactNode } from 'react';
import type { EnginePlan } from '../../../engine/contracts';
import type { PlanVersion, SessionTemplate } from '../../../domain/v8/contracts';
import { engineDisplayNotices } from '../../../application/engine-presentation';
import { regionLabels, sessionNames, weekSchedule, weekdayLabel, weekdays, type Weekday } from '../../../application/plan-presentation';
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
}
/** One-week calendar: strip of seven days, then one tile per session with weekday, name, minutes and body parts. */
export function WeekPlan({ plan, locale, today, done = {}, focusId, details }: WeekPlanProps) {
  const t = planViewCopy[locale], view = usePlanView(plan, locale);
  const max = Math.max(1, ...plan.templates.map(template => template.estimatedMinutes));
  const total = view.schedule.sessions.reduce((sum, session) => sum + (view.byId.get(session.templateId)?.estimatedMinutes ?? 0), 0);
  const days = weekdays.map((day, index) => {
    const session = view.schedule.sessions.find(item => item.day === day), template = session && view.byId.get(session.templateId);
    const state = done[day] ?? (template ? 'planned' : 'rest');
    return { key: day, label: weekdayLabel(day, locale, true), state, today: today === index, level: template ? template.estimatedMinutes / max : 0,
      description: `${weekdayLabel(day, locale)} · ${template ? `${view.name(template)} · ${fill(t.minutes, { count: template.estimatedMinutes })}` : t.rest}${done[day] === 'done' ? ` · ${t.done}` : done[day] === 'partial' ? ` · ${t.partial}` : ''}` } as const;
  });
  return <section className="v9-week-plan" aria-label={t.week}>
    <Card variant="raised" padding="lg" className="v9-week-summary">
      <div className="v9-week-summary-head">
        <span className="v9-week-summary-label">{t.thisWeek}</span>
        <span className="v9-num v9-week-summary-count">{view.schedule.sessions.length}<small>{t.sessionsUnit}</small></span>
        <span className="v9-num v9-week-summary-minutes">{fill(t.totalMinutes, { count: total })}</span>
      </div>
      <WeekStrip label={t.week} days={days} variant="bars" />
      {!view.schedule.chosen && <p className="v9-week-note">{t.suggestedDays}</p>}
    </Card>
    <ol className="v9-session-list">{view.schedule.sessions.map((session, index) => {
      const template = view.byId.get(session.templateId)!, focus = index === Math.max(0, focusId ? view.schedule.sessions.findIndex(item => item.templateId === focusId) : 0);
      const parts = regionLabels(template, locale);
      // Safety cues (e.g. 扶墙或扶椅) stay visible on the folded row, not only inside the details.
      const cues = [...new Set(template.items.map(item => item.prescription?.safetyCue?.[locale]).filter((cue): cue is string => !!cue))];
      const head = <>
        <span className="v9-session-dot" aria-hidden="true" />
        <span className="v9-session-text"><span className="v9-session-day">{weekdayLabel(session.day, locale)}{today === weekdays.indexOf(session.day) ? ` · ${t.today}` : ''}</span><span className="v9-session-name">{view.name(template)}</span>
          {parts.length > 0 && <span className="v9-session-parts">{parts.join(' · ')}</span>}
          {cues.length > 0 && <span className="v9-session-cue">{cues.join(' · ')}</span>}</span>
        <span className="v9-num v9-session-minutes">{template.estimatedMinutes}<small>′</small></span>
      </>;
      return <li key={`${session.day}-${template.id}`} className="v9-session" data-focus={focus ? 'true' : 'false'}>
        {details ? <details><summary aria-label={`${weekdayLabel(session.day, locale)} ${view.name(template)} · ${fill(t.minutes, { count: template.estimatedMinutes })}${parts.length ? ` · ${parts.join('、')}` : ''}`}>{head}</summary><div className="v9-session-details">{details(template)}</div></details> : <div className="v9-session-row">{head}</div>}
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
export function SessionItems({ template, locale, name, onExercise, hideDistance }: { template: SessionTemplate; locale: 'zh' | 'en'; name: (id: string) => string; onExercise?: (exerciseId: string, index: number, trigger: HTMLElement) => void; hideDistance?: (exerciseId: string) => boolean }) {
  const t = planViewCopy[locale];
  return <ul className="v9-items">{template.items.map((item, index) => {
    const strength = item.prescription && ['main', 'accessory'].includes(item.prescription.block);
    const note = [item.prescription?.loadDescription?.[locale], item.prescription?.safetyCue?.[locale], strength ? effortWords(item.prescription?.rir, locale) : undefined].filter(Boolean).join(' · ');
    const body = <><span className="v9-item-name">{name(item.exerciseId)}</span>
      <span className="v9-item-target v9-num">{fill(t.sets, { count: item.sets })} · {targetText(item.target, locale, hideDistance?.(item.exerciseId))}</span>
      <span className="v9-item-equipment">{equipmentLabel(item.equipment, locale)}</span>
      {note && <span className="v9-item-note">{note}</span>}</>;
    return <li key={`${item.exerciseId}-${index}`}>{onExercise ? <button type="button" className="v9-item v8-press" onClick={event => onExercise(item.exerciseId, index, event.currentTarget)}>{body}</button> : <div className="v9-item">{body}</div>}</li>;
  })}</ul>;
}
