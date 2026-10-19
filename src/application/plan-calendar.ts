import type { PlanVersion, WorkoutRecord } from '../domain/v8/contracts';
import { addDays, weekdayOf, weekdays } from './plan-presentation';
import { sessionForDate } from './training-dates';

/**
 * Month calendar of a plan (计划 › 月). Read-only projection: dates come from the chosen training days,
 * or the plan's weekly schedule from its start date; states from recorded workouts. Nothing here is stored.
 */
export type CalendarDayState = 'done' | 'partial' | 'planned' | 'missed' | 'rest';
export interface CalendarDay {
  date: string;
  /** False for the leading/trailing days that fill the first and last week rows. */
  inMonth: boolean;
  state: CalendarDayState;
  /** Session planned on this day (from the weekly schedule), if any. */
  templateId?: string;
  /** Finished workouts recorded on this local date (complete or partial), newest first. */
  workouts: WorkoutRecord[];
}

const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
export const monthOf = (date: string) => date.slice(0, 7);
export function shiftMonth(month: string, delta: number): string {
  const [year, value] = month.split('-').map(Number), index = year * 12 + (value - 1) + delta;
  return `${String(Math.floor(index / 12)).padStart(4, '0')}-${String((index % 12) + 1).padStart(2, '0')}`;
}
/** Monday-first dates covering every week that touches the month (5 or 6 rows of 7). */
export function monthGridDates(month: string): string[] {
  if (!monthPattern.test(month)) throw new RangeError('month must be YYYY-MM');
  const first = `${month}-01`, start = addDays(first, -weekdays.indexOf(weekdayOf(first)));
  const next = `${shiftMonth(month, 1)}-01`, last = addDays(next, -1);
  const end = addDays(last, 6 - weekdays.indexOf(weekdayOf(last)));
  const dates: string[] = [];
  for (let date = start; date <= end; date = addDays(date, 1)) dates.push(date);
  return dates;
}

const finished = (workout: WorkoutRecord) => workout.status === 'complete' || workout.status === 'partial';

export function monthCalendar({ plan, workouts, month, today, startDate }: {
  plan: Pick<PlanVersion, 'weeklyTarget' | 'preferredDays' | 'templates'> & Partial<Pick<PlanVersion, 'trainingDates'>>;
  workouts: readonly WorkoutRecord[];
  month: string;
  /** Today's local date (YYYY-MM-DD): earlier planned days without a record are "missed". */
  today: string;
  /** Plan start (chosen or creation day); nothing is planned before it. */
  startDate?: string;
}): CalendarDay[] {
  const byDate = new Map<string, WorkoutRecord[]>();
  for (const workout of workouts) if (finished(workout)) byDate.set(workout.localDate, [...(byDate.get(workout.localDate) ?? []), workout]);
  return monthGridDates(month).map(date => {
    const recorded = (byDate.get(date) ?? []).slice().sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const templateId = sessionForDate(plan, date, startDate);
    const state: CalendarDayState = recorded.some(workout => workout.status === 'complete') ? 'done'
      : recorded.length ? 'partial'
      : templateId ? (date < today ? 'missed' : 'planned') : 'rest';
    return { date, inMonth: monthOf(date) === month, state, templateId, workouts: recorded };
  });
}

/** Counts for the month's own days (not the filler days of neighbouring months). */
export function monthCounts(days: readonly CalendarDay[]) {
  const own = days.filter(day => day.inMonth);
  return {
    done: own.filter(day => day.state === 'done').length,
    partial: own.filter(day => day.state === 'partial').length,
    planned: own.filter(day => day.state === 'planned').length,
    missed: own.filter(day => day.state === 'missed').length,
  };
}

/** Done/partial marks of the Monday week containing `today`, keyed by weekday (week view). */
export function weekDoneDays(workouts: readonly WorkoutRecord[], today: string) {
  const monday = addDays(today, -weekdays.indexOf(weekdayOf(today)));
  const marks: Partial<Record<(typeof weekdays)[number], 'done' | 'partial'>> = {};
  for (const workout of workouts) {
    if (!finished(workout) || workout.localDate < monday || workout.localDate > addDays(monday, 6)) continue;
    const day = weekdayOf(workout.localDate);
    if (workout.status === 'complete') marks[day] = 'done';
    else if (marks[day] !== 'done') marks[day] = 'partial';
  }
  return marks;
}
