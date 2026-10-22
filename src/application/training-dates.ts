import type { PlanVersion } from '../domain/v8/contracts';
import { addDays, daysBetween, isLocalDate } from '../domain/local-date';
import { weekSchedule, weekdayOf } from './plan-presentation';

/**
 * Training days picked on a month calendar (Bo 2026-10-19): 1–30 chosen dates instead of a fixed
 * weekly count. Pure helpers only; nothing here reads or writes storage.
 */
/** At most this many days from the first to the last chosen date (inclusive), so 1–30 days. */
const TRAINING_SPAN_DAYS = 30;
/** The first training day falls within today and the next two weeks (same rule as the start date). */
const TRAINING_START_WINDOW_DAYS = 14;
/** Engine limit (daysPerWeek ≤ 6): any 7 consecutive days keep at least one rest day. */
const TRAINING_MAX_PER_7_DAYS = 6;

export { isLocalDate, daysBetween };
export const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Every date from `a` to `b` inclusive, in calendar order (either may come first). */
export function dateRange(a: string, b: string): string[] {
  const [from, to] = a <= b ? [a, b] : [b, a],
    dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/** Whether a calendar day can be tapped, given today and what is already chosen. */
export function selectableDate(date: string, today: string, chosen: readonly string[]): boolean {
  if (!isLocalDate(date) || date < today) return false;
  const sorted = [...chosen].sort(),
    first = sorted[0],
    last = sorted.at(-1);
  if (!first || !last) return date <= addDays(today, TRAINING_START_WINDOW_DAYS);
  if (sorted.includes(date)) return true;
  // A new first day still has to start within two weeks; the whole plan spans at most 30 days.
  if (date < first)
    return date <= addDays(today, TRAINING_START_WINDOW_DAYS) && daysBetween(date, last) < TRAINING_SPAN_DAYS;
  return daysBetween(first, date) < TRAINING_SPAN_DAYS;
}

export interface NormalizedDates {
  dates: string[];
  /** Dates dropped to keep the 30-day span or the start window. */
  outside: string[];
  /** Dates dropped so every 7 consecutive days keep one rest day. */
  rest: string[];
}
/**
 * Conservative clean-up of a selection: valid dates from today, first day within two weeks,
 * span ≤ 30 days, and never 7 training days in a row (the latest offending day is left out).
 */
export function normalizeTrainingDates(input: readonly string[], today: string): NormalizedDates {
  const valid = [...new Set(input.filter(isLocalDate))].sort();
  const outside = valid.filter(date => date < today);
  let candidates = valid.filter(date => date >= today);
  const startLimit = addDays(today, TRAINING_START_WINDOW_DAYS);
  while (candidates.length && candidates[0] > startLimit) outside.push(candidates.shift()!);
  const first = candidates[0];
  if (first) {
    outside.push(...candidates.filter(date => daysBetween(first, date) >= TRAINING_SPAN_DAYS));
    candidates = candidates.filter(date => daysBetween(first, date) < TRAINING_SPAN_DAYS);
  }
  const dates: string[] = [],
    rest: string[] = [];
  for (const date of candidates) {
    const recent = dates.filter(kept => daysBetween(kept, date) < 7).length;
    if (recent >= TRAINING_MAX_PER_7_DAYS) rest.push(date);
    else dates.push(date);
  }
  return { dates, outside: outside.sort(), rest };
}

/** Training days must already be clean (sorted, unique, in range); used before saving. */
export function validTrainingDates(dates: readonly string[]): boolean {
  if (!dates.length || dates.length > TRAINING_SPAN_DAYS || !dates.every(isLocalDate)) return false;
  for (let index = 1; index < dates.length; index++) if (dates[index] <= dates[index - 1]) return false;
  if (daysBetween(dates[0], dates.at(-1)!) >= TRAINING_SPAN_DAYS) return false;
  return dates.every(
    (date, index) => dates.slice(0, index).filter(kept => daysBetween(kept, date) < 7).length < TRAINING_MAX_PER_7_DAYS,
  );
}

/** Busiest 7-day stretch of the selection: the weekly frequency the plan is built for (1–6). */
export function weeklyTargetFromDates(dates: readonly string[]): number {
  let most = 0;
  for (const date of dates)
    most = Math.max(most, dates.filter(other => other >= date && daysBetween(date, other) < 7).length);
  return Math.max(1, Math.min(TRAINING_MAX_PER_7_DAYS, most));
}

/** Moves every chosen day so the first one lands on `startDate` (the rhythm stays the same). */
export function shiftTrainingDates(dates: readonly string[], startDate: string): string[] {
  if (!dates.length) return [];
  const delta = daysBetween(dates[0], startDate);
  return dates.map(date => addDays(date, delta));
}

type DatedPlan = Pick<PlanVersion, 'weeklyTarget' | 'preferredDays' | 'templates'> &
  Partial<Pick<PlanVersion, 'trainingDates'>>;
/**
 * Session planned on a date. Chosen training days take turns through the sessions in date order;
 * plans without chosen days keep their weekly rhythm from the start date.
 */
export function sessionForDate(plan: DatedPlan, date: string, startDate?: string): string | undefined {
  if (!plan.templates.length) return undefined;
  if (plan.trainingDates?.length) {
    const index = plan.trainingDates.indexOf(date);
    return index < 0 ? undefined : plan.templates[index % plan.templates.length].id;
  }
  if (startDate && date < startDate) return undefined;
  return weekSchedule(plan).sessions.find(session => session.day === weekdayOf(date))?.templateId;
}

/** Next chosen training day on or after `from`. */
export const nextTrainingDate = (dates: readonly string[] | undefined, from: string) =>
  dates?.find(date => date >= from);
