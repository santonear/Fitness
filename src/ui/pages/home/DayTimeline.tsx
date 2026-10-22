import { useRef, useState, type ReactNode } from 'react';
import type { PlannedItem, SessionTemplate, WorkoutRecord } from '../../../domain/v8/contracts';
import {
  clockIn,
  clockMinutes,
  defaultStartClock,
  durationMinutes,
  itemActualTimes,
  sessionTimeline,
  stepClock,
  validClock,
  workoutTimes,
  zonedInstant,
  type TimelinePhase,
} from '../../../application/day-timeline';
import { dayViewCopy } from '../../../i18n/features/home/day-view';
import { planViewCopy } from '../../../i18n/features/plan/view';
import { fill } from '../../../i18n/features/onboarding/entry';
import { Card, PrimaryButton } from '../../components/kit';
import { MorphPanel } from '../../components/common/MorphPanel';
import './day-timeline.css';
import { utcDay, DAY_MS } from '../../../domain/local-date';

type Locale = 'zh' | 'en';
const START_KEY = 'fitness.day-start';
/** The planned start chosen today (per-device convenience only; never part of the training record). */
function readStart(date: string): string | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(START_KEY) ?? 'null') as { date?: string; clock?: string } | null;
    return value?.date === date && value.clock && validClock(value.clock) ? value.clock : undefined;
  } catch {
    return undefined;
  }
}
function writeStart(date: string, clock: string) {
  try {
    localStorage.setItem(START_KEY, JSON.stringify({ date, clock }));
  } catch {
    /* storage unavailable: the choice lasts for this view */
  }
}

export interface DayTimelineProps {
  template: SessionTemplate;
  locale: Locale;
  timeZone: string;
  todayDate: string;
  name: (exerciseId: string) => string;
  /** Workout in progress, if any: its real start replaces the planned one. */
  active?: WorkoutRecord;
  /** Expandable content of one exercise step (how-to, prescription, tools). */
  details?: (item: PlannedItem, index: number) => ReactNode;
  /** Start time chosen with the plan's training days (HH:MM); today's own choice still wins. */
  planStart?: string;
}

/** 今天 › 日视图: the session as numbered steps (warm-up → exercises → cool-down) with estimated clock times. */
export function DayTimeline({
  template,
  locale,
  timeZone,
  todayDate,
  name,
  active,
  details,
  planStart,
}: DayTimelineProps) {
  const t = dayViewCopy[locale],
    pv = planViewCopy[locale];
  const [chosen, setChosen] = useState(() => readStart(todayDate) ?? planStart ?? defaultStartClock(timeZone));
  const startClock = active ? clockIn(timeZone, active.startedAt) : chosen;
  const timeline = sessionTimeline(template),
    total = Math.round(timeline.totalSeconds / 60);
  let previous: TimelinePhase | undefined;
  return (
    <Card
      variant="raised"
      padding="md"
      as="section"
      className="v9-home-panel v9-day"
      aria-labelledby="v9-home-items-title"
    >
      <div className="v9-day-head">
        <h2 id="v9-home-items-title" className="v9-home-items-title">
          {t.title} · {fill(pv.exercises, { count: template.items.length })}
        </h2>
        {active ? (
          <p className="v9-day-hint" role="status">
            {fill(t.inProgress, { start: startClock })}
          </p>
        ) : (
          <label className="v9-day-start">
            <span>{t.startAt}</span>
            <input
              type="time"
              className="v9-num"
              value={chosen}
              step={300}
              onChange={event => {
                const value = event.currentTarget.value;
                if (validClock(value)) {
                  setChosen(value);
                  writeStart(todayDate, value);
                }
              }}
            />
          </label>
        )}
      </div>
      <p className="v9-day-hint">
        {fill(t.ends, { time: stepClock(startClock, timeline.totalSeconds), minutes: total })}
        {active ? '' : ` · ${t.startHint}`}
      </p>
      <ol className="v9-home-items v9-day-steps">
        {timeline.steps.map(step => {
          const phaseLabel = step.phase !== previous ? t.phases[step.phase] : undefined;
          previous = step.phase;
          const clock = stepClock(startClock, step.startOffset),
            minutes = Math.max(1, Math.round(step.durationSeconds / 60));
          const item = step.itemIndex === undefined ? undefined : template.items[step.itemIndex];
          const marker = (
            <span className="v9-day-marker" aria-hidden="true">
              <span className="v9-num v9-day-number">{step.number}</span>
            </span>
          );
          const time = (
            <time className="v9-num v9-day-time" aria-label={`${fill(t.step, { number: step.number })} · ${clock}`}>
              {clock}
            </time>
          );
          return (
            <li
              key={`${step.kind}-${step.itemIndex ?? step.number}`}
              className="v9-day-step"
              data-phase={step.phase}
              data-kind={step.kind}
            >
              {phaseLabel && <span className="v9-day-phase">{phaseLabel}</span>}
              <div className="v9-day-row">
                {time}
                {marker}
                {item ? (
                  <details className="v9-day-body">
                    <summary>
                      <span className="v9-day-name">
                        {name(item.exerciseId)} · {fill(t.sets, { count: item.sets })}
                      </span>
                      <span className="v9-day-meta v9-num">{fill(t.estimate, { minutes })}</span>
                    </summary>
                    {details?.(item, step.itemIndex!)}
                  </details>
                ) : (
                  <div className="v9-day-body v9-day-frame">
                    <span className="v9-day-name">{step.kind === 'prepare' ? t.prepare : t.stretch}</span>
                    <span className="v9-day-meta v9-num">{fill(t.estimate, { minutes })}</span>
                    <p>{step.kind === 'prepare' ? t.prepareHint : t.stretchHint}</p>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

export interface DayActualProps {
  workouts: readonly WorkoutRecord[];
  templates: readonly SessionTemplate[];
  locale: Locale;
  name: (exerciseId: string) => string;
  sessionName: (templateId?: string) => string;
  busy?: boolean;
  /** Appends a time correction (recorded times stay unchanged); resolves true when saved. */
  onCorrect: (workout: WorkoutRecord, startedAt: string, endedAt: string) => Promise<boolean>;
}

/** Today's finished sessions: real start/end (from the record, or the user's latest correction) and when each step was done. */
export function DayActual({ workouts, templates, locale, name, sessionName, busy, onCorrect }: DayActualProps) {
  const t = dayViewCopy[locale];
  const trigger = useRef<HTMLElement | null>(null);
  const [editing, setEditing] = useState<{ workout: WorkoutRecord; start: string; end: string; error?: boolean }>();
  if (!workouts.length) return null;
  const save = async () => {
    if (!editing) return;
    const { workout, start, end } = editing;
    if (!validClock(start) || !validClock(end)) return setEditing({ ...editing, error: true });
    const startedAt = zonedInstant(workout.localDate, start, workout.timeZone);
    // An end clock earlier than the start means the session ran past midnight.
    const endDate =
      clockMinutes(end) <= clockMinutes(start)
        ? utcDay(Date.parse(`${workout.localDate}T00:00:00Z`) + DAY_MS)
        : workout.localDate;
    const endedAt = zonedInstant(endDate, end, workout.timeZone);
    if (Date.parse(endedAt) <= Date.parse(startedAt) || Date.parse(endedAt) > Date.now())
      return setEditing({ ...editing, error: true });
    if (await onCorrect(workout, startedAt, endedAt)) setEditing(undefined);
  };
  return (
    <Card
      variant="raised"
      padding="md"
      as="section"
      className="v9-home-panel v9-day v9-day-actual"
      aria-labelledby="v9-day-actual-title"
    >
      <h2 id="v9-day-actual-title" className="v9-home-items-title">
        {t.actualTitle}
      </h2>
      {workouts.map(workout => {
        const times = workoutTimes(workout),
          zone = workout.timeZone,
          minutes = durationMinutes(times.startedAt, times.endedAt);
        const template = workout.templateSnapshot ?? templates.find(item => item.id === workout.templateId);
        const actual = itemActualTimes(workout);
        const planned = (index: number, item: PlannedItem) =>
          workout.plannedExercises?.find(row => row.itemIndex === index)?.plannedSetCount ?? item.sets;
        return (
          <article key={workout.id} className="v9-day-record" data-testid="day-actual">
            {sessionName(workout.templateId) && <h3>{sessionName(workout.templateId)}</h3>}
            <p className="v9-num v9-day-actual-line" data-testid="day-actual-line">
              {times.endedAt
                ? fill(t.actualLine, {
                    start: clockIn(zone, times.startedAt),
                    end: clockIn(zone, times.endedAt),
                    minutes: minutes ?? 0,
                  })
                : fill(t.actualOpen, { start: clockIn(zone, times.startedAt) })}
            </p>
            {times.corrected && (
              <p className="v9-day-hint">
                {fill(t.corrected, {
                  start: clockIn(zone, times.recorded.startedAt),
                  end: times.recorded.endedAt ? clockIn(zone, times.recorded.endedAt) : '—',
                })}
              </p>
            )}
            {template && (
              <ol className="v9-day-steps v9-day-done">
                {template.items.map((item, index) => {
                  const done = actual.get(index);
                  return (
                    <li key={index} className="v9-day-step" data-done={done ? 'true' : 'false'}>
                      <div className="v9-day-row">
                        <span className="v9-num v9-day-time">{done ? clockIn(zone, done.last) : '—'}</span>
                        <span className="v9-day-marker" aria-hidden="true">
                          <span className="v9-num v9-day-number">{index + 1}</span>
                        </span>
                        <div className="v9-day-body v9-day-frame">
                          <span className="v9-day-name">{name(item.exerciseId)}</span>
                          <span className="v9-day-meta">
                            {done
                              ? `${fill(t.finishedAt, { time: clockIn(zone, done.last) })} · ${fill(t.setsDone, { done: done.sets, planned: planned(index, item) })}`
                              : t.notDone}
                          </span>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
            <PrimaryButton
              tone="quiet"
              size="sm"
              disabled={busy}
              onClick={event => {
                trigger.current = event.currentTarget;
                setEditing({
                  workout,
                  start: clockIn(zone, times.startedAt),
                  end: times.endedAt ? clockIn(zone, times.endedAt) : clockIn(zone, new Date()),
                });
              }}
            >
              {t.adjust}
            </PrimaryButton>
          </article>
        );
      })}
      <MorphPanel
        open={!!editing}
        title={t.adjustTitle}
        closeLabel={t.cancel}
        onClose={() => {
          if (!busy) setEditing(undefined);
        }}
        triggerRef={trigger}
      >
        <p>{t.adjustHint}</p>
        {editing && (
          <div className="v9-day-adjust">
            <label>
              <span>{t.start}</span>
              <input
                type="time"
                className="v9-num"
                value={editing.start}
                onChange={event => setEditing({ ...editing, start: event.currentTarget.value, error: false })}
              />
            </label>
            <label>
              <span>{t.end}</span>
              <input
                type="time"
                className="v9-num"
                value={editing.end}
                onChange={event => setEditing({ ...editing, end: event.currentTarget.value, error: false })}
              />
            </label>
          </div>
        )}
        {editing?.error && (
          <p role="alert" className="v9-day-error">
            {t.invalid}
          </p>
        )}
        <PrimaryButton disabled={busy} onClick={() => void save()}>
          {t.save}
        </PrimaryButton>
      </MorphPanel>
    </Card>
  );
}
