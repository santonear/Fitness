import { useMemo, useState, type ReactNode } from 'react';
import type { PlanVersion, SessionTemplate, WorkoutRecord } from '../../../domain/v8/contracts';
import { monthCalendar, monthCounts, monthOf, shiftMonth, type CalendarDay } from '../../../application/plan-calendar';
import { startDateLabel, weekdayLabel, weekdays } from '../../../application/plan-presentation';
import { clockIn, workoutTimes } from '../../../application/day-timeline';
import { planCalendarCopy } from '../../../i18n/features/plan/calendar';
import { templateLabel } from '../../../i18n/features/plan/labels';
import { fill } from '../../../i18n/features/onboarding/entry';
import { Card, PrimaryButton } from '../../components/kit';
import { usePlanView } from './WeekPlan';
import { monthTitle } from '../../components/TrainingCalendar';
import './week-plan.css';

interface MonthPlanProps {
  plan: Pick<PlanVersion, 'weeklyTarget' | 'preferredDays' | 'templates'> & Partial<Pick<PlanVersion, 'trainingDates'>>;
  workouts: readonly WorkoutRecord[];
  /** Day selected (and month shown) first; defaults to today. */
  initialDate?: string;
  locale: 'zh' | 'en';
  todayDate: string;
  startDate?: string;
  timeZone: string;
  /** Exercise list of the selected day's planned session. */
  details?: (template: SessionTemplate) => ReactNode;
}

/** Month calendar of the plan: each day marked done / partly done / planned / not trained; tap a day for its session. */
export function MonthPlan({
  plan,
  workouts,
  locale,
  todayDate,
  startDate,
  timeZone,
  details,
  initialDate,
}: MonthPlanProps) {
  const t = planCalendarCopy[locale],
    view = usePlanView(plan, locale);
  const [month, setMonth] = useState(monthOf(initialDate ?? todayDate)),
    [selected, setSelected] = useState<string>(initialDate ?? todayDate);
  const days = useMemo(
    () => monthCalendar({ plan, workouts, month, today: todayDate, startDate }),
    [plan, workouts, month, todayDate, startDate],
  );
  const counts = monthCounts(days),
    title = monthTitle(month, locale);
  const chosen = days.find(day => day.date === selected && day.inMonth);
  const sessionName = (day: CalendarDay) => {
    const template = day.templateId ? view.byId.get(day.templateId) : undefined;
    return template ? view.name(template) : '';
  };
  const describe = (day: CalendarDay) =>
    [startDateLabel(day.date, todayDate, locale), t.states[day.state], sessionName(day)].filter(Boolean).join(' · ');
  const go = (delta: number) => {
    const next = shiftMonth(month, delta);
    setMonth(next);
    setSelected(monthOf(todayDate) === next ? todayDate : `${next}-01`);
  };
  return (
    <section className="v9-month-plan" aria-label={fill(t.calendar, { month: title })}>
      <Card variant="raised" padding="lg" className="v9-month-card">
        <div className="v9-month-head">
          <PrimaryButton tone="quiet" size="sm" aria-label={t.prev} onClick={() => go(-1)}>
            <span aria-hidden="true">‹</span>
          </PrimaryButton>
          <h2 className="v9-month-title" aria-live="polite">
            {title}
          </h2>
          <PrimaryButton tone="quiet" size="sm" aria-label={t.next} onClick={() => go(1)}>
            <span aria-hidden="true">›</span>
          </PrimaryButton>
        </div>
        <div className="v9-month-weekdays" aria-hidden="true">
          {weekdays.map(day => (
            <span key={day}>{weekdayLabel(day, locale, true)}</span>
          ))}
        </div>
        <ol className="v9-month-grid">
          {days.map(day => (
            <li key={day.date} data-in-month={day.inMonth ? 'true' : 'false'}>
              {day.inMonth ? (
                <button
                  type="button"
                  className="v9-month-day v8-press"
                  data-state={day.state}
                  data-date={day.date}
                  aria-pressed={day.date === selected}
                  aria-current={day.date === todayDate ? 'date' : undefined}
                  aria-label={describe(day)}
                  onClick={() => setSelected(day.date)}
                >
                  <span className="v9-body v9-month-number">{Number(day.date.slice(8))}</span>
                  <span className="v9-month-mark" aria-hidden="true" />
                </button>
              ) : (
                <span className="v9-month-filler v9-num" aria-hidden="true">
                  {Number(day.date.slice(8))}
                </span>
              )}
            </li>
          ))}
        </ol>
        <ul className="v9-month-legend" aria-label={t.legend}>
          <li data-state="today">
            <span className="v9-month-mark" aria-hidden="true" />
            {t.today}
          </li>
          {(['done', 'partial', 'planned', 'missed'] as const).map(state => (
            <li key={state} data-state={state}>
              <span className="v9-month-mark" aria-hidden="true" />
              {t.states[state]}
            </li>
          ))}
        </ul>
        <p className="v9-month-counts">{fill(t.counts, counts)}</p>
      </Card>
      {chosen ? (
        <MonthDayDetail
          day={chosen}
          t={t}
          locale={locale}
          todayDate={todayDate}
          startDate={startDate}
          timeZone={timeZone}
          view={view}
          details={details}
        />
      ) : (
        <p className="v9-month-counts">{t.pick}</p>
      )}
    </section>
  );
}

function MonthDayDetail({
  day,
  t,
  locale,
  todayDate,
  startDate,
  timeZone,
  view,
  details,
}: {
  day: CalendarDay;
  t: (typeof planCalendarCopy)['zh' | 'en'];
  locale: 'zh' | 'en';
  todayDate: string;
  startDate?: string;
  timeZone: string;
  view: ReturnType<typeof usePlanView>;
  details?: MonthPlanProps['details'];
}) {
  const template = day.templateId ? view.byId.get(day.templateId) : undefined;
  return (
    <Card
      variant="raised"
      padding="md"
      as="section"
      className="v9-month-detail"
      aria-labelledby="v9-month-detail-title"
      data-state={day.state}
    >
      <h3 id="v9-month-detail-title">
        {startDateLabel(day.date, todayDate, locale)}
        <span className="v9-month-detail-state"> · {t.states[day.state]}</span>
      </h3>
      {day.workouts.length > 0 && (
        <div className="v9-month-recorded">
          <h4>{t.recorded}</h4>
          <ul>
            {day.workouts.map(workout => {
              const times = workoutTimes(workout),
                name =
                  workout.templateId && view.byId.get(workout.templateId)
                    ? view.name(view.byId.get(workout.templateId)!)
                    : workout.templateSnapshot
                      ? templateLabel(workout.templateSnapshot, locale)
                      : '';
              return (
                <li key={workout.id}>
                  {name && <strong>{name}</strong>}
                  <span className="v9-num">
                    {fill(t.sets, { done: workout.sets.length, planned: workout.plannedSetCount })}
                  </span>
                  {times.endedAt && (
                    <span className="v9-num">
                      {fill(t.time, {
                        start: clockIn(timeZone, times.startedAt),
                        end: clockIn(timeZone, times.endedAt),
                      })}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          {template && day.workouts.every(workout => workout.templateId !== template.id) && <p>{t.otherSession}</p>}
        </div>
      )}
      {template ? (
        <div className="v9-month-planned">
          <h4>{t.planned}</h4>
          <p>
            <strong>{view.name(template)}</strong> · {fill(t.minutes, { count: template.estimatedMinutes })}
          </p>
          {details?.(template)}
        </div>
      ) : (
        !day.workouts.length && <p>{startDate && day.date < startDate ? t.beforeStart : t.restDay}</p>
      )}
    </Card>
  );
}
