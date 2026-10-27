import { activeWorkoutSeconds } from '../workout-duration';
import { workoutTimes } from '../day-timeline';
import type { WorkoutRecord } from '../../domain/v8/contracts';
import { addDays, isLocalDate, todayIn, weekStart } from '../../domain/local-date';

/** Read-only chart projection for the V9 review and finish screens. Never writes or infers facts. */
export interface ChartWorkout {
  id: string;
  startedAt: string;
  endedAt?: string;
  timeCorrections?: WorkoutRecord['timeCorrections'];
  localDate?: string;
  status: string;
  sets: readonly { reps?: number; loadGrams?: number | null; durationSeconds?: number; completedAt?: string }[];
}
interface ChartBucket {
  key: string;
  from: string;
  to: string;
}
export interface ChartPoint extends ChartBucket {
  sessions: number;
  volumeKg: number;
  minutes: number;
}
export type ChartMetric = 'sessions' | 'volumeKg' | 'minutes';

const moved = (row: ChartWorkout) => row.status === 'complete' || row.status === 'partial';
export { addDays as shiftDate, weekStart };

/** Review day of a workout: its (latest corrected) start in the viewing time zone; saved local date as fallback. */
export function dayOf(row: ChartWorkout, timeZone: string): string {
  const value = todayIn(timeZone, workoutTimes(row).startedAt);
  return isLocalDate(value) ? value : (row.localDate ?? '');
}
/** Total lifted in kilograms: reps × load for loaded sets only. Bodyweight and timed sets add nothing. */
export function volumeKg(row: ChartWorkout): number {
  const grams = row.sets.reduce(
    (sum, set) =>
      sum +
      (typeof set.reps === 'number' && typeof set.loadGrams === 'number' && set.loadGrams > 0
        ? set.reps * set.loadGrams
        : 0),
    0,
  );
  return Math.round(grams / 100) / 10;
}
/** Uses the latest user time correction, like the calendar. */
export const sessionMinutes = (row: ChartWorkout) => Math.floor(activeWorkoutSeconds(row) / 60);

/** Seven days starting at `from`. */
export const dayBuckets = (from: string): ChartBucket[] =>
  Array.from({ length: 7 }, (_, index) => {
    const day = addDays(from, index);
    return { key: day, from: day, to: day };
  });
/** Calendar weeks (Mon–Sun) overlapping [from, to]. */
export function weekBuckets(from: string, to: string): ChartBucket[] {
  const result: ChartBucket[] = [];
  for (let start = weekStart(from); start <= to; start = addDays(start, 7))
    result.push({ key: start, from: start, to: addDays(start, 6) });
  return result;
}
export function chartSeries(
  rows: readonly ChartWorkout[],
  buckets: readonly ChartBucket[],
  timeZone: string,
): ChartPoint[] {
  const unique = rows.filter(moved).filter((row, index, all) => all.findIndex(other => other.id === row.id) === index);
  return buckets.map(bucket => {
    const inside = unique.filter(row => {
      const day = dayOf(row, timeZone);
      return day >= bucket.from && day <= bucket.to;
    });
    return {
      ...bucket,
      sessions: inside.length,
      volumeKg: Math.round(inside.reduce((sum, row) => sum + volumeKg(row), 0) * 10) / 10,
      minutes: inside.reduce((sum, row) => sum + sessionMinutes(row), 0),
    };
  });
}

/**
 * Plain weekly progress: sessions that moved (complete or partial) against the weekly target.
 * A partial session counts as a session done, so "还可以再练" never double counts it.
 */
export function weeklyRemaining(target: number, complete: number, partial: number) {
  const done = Math.max(0, complete) + Math.max(0, partial);
  return { done, left: Math.max(0, Math.round(target) - done) };
}
/** Fewest saved sessions in a period before the review describes timing patterns. */
export const PATTERN_MIN_SESSIONS = 4;
/** Fewest occurrences in one weekday/time band before it is called a pattern. */
export const PATTERN_MIN_COUNT = 2;

/** Consecutive weeks, ending with the week of `today`, that contain at least one session that moved. */
export function weekStreak(rows: readonly ChartWorkout[], today: string, timeZone: string): number {
  const weeks = new Set(rows.filter(moved).map(row => weekStart(dayOf(row, timeZone))));
  let count = 0;
  for (let start = weekStart(today); weeks.has(start); start = addDays(start, -7)) count++;
  return count;
}
