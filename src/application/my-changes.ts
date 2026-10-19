import type { BodyWeightObservation } from '../domain/models';
import type { WorkoutRecord } from '../domain/v8/contracts';

/**
 * 我的变化: read-only trends from data already on this device (body measurements, finished
 * workouts). Nothing is stored or sent; missing data stays missing (no interpolation).
 */
export interface TrendPoint { date: string; value: number }
export interface Trend { points: TrendPoint[]; first?: TrendPoint; last?: TrendPoint; change?: number }

const trend = (points: TrendPoint[]): Trend => {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = sorted[0], last = sorted.at(-1);
  return { points: sorted, first, last, change: first && last && sorted.length > 1 ? Math.round((last.value - first.value) * 10) / 10 : undefined };
};
/** One value per local date: the latest entered that day. */
function perDay(rows: readonly BodyWeightObservation[], pick: (row: BodyWeightObservation) => number | undefined): TrendPoint[] {
  const byDate = new Map<string, BodyWeightObservation>();
  for (const row of rows) { if (pick(row) === undefined) continue; const current = byDate.get(row.localDate); if (!current || row.updatedAt > current.updatedAt) byDate.set(row.localDate, row); }
  return [...byDate.values()].map(row => ({ date: row.localDate, value: pick(row)! }));
}
export const weightTrend = (rows: readonly BodyWeightObservation[]) => trend(perDay(rows, row => Math.round(row.weightGrams / 100) / 10));
export const bodyFatTrend = (rows: readonly BodyWeightObservation[]) => trend(perDay(rows, row => row.bodyFatPercent));

const finished = (workout: WorkoutRecord) => workout.status === 'complete' || workout.status === 'partial';
/** Estimated one-rep max (Epley) for sets of 1–12 reps; heavier rep ranges are not extrapolated. */
export function estimatedOneRepMaxKg(loadGrams: number, reps: number): number | undefined {
  if (!(loadGrams > 0) || !(reps >= 1) || reps > 12) return undefined;
  return Math.round((loadGrams / 1000) * (reps === 1 ? 1 : 1 + reps / 30) * 10) / 10;
}
export interface StrengthTrend extends Trend { exerciseId: string; sets: number }
/** Main lifts = the loaded exercises the user did most often; per date the best estimated 1RM. */
export function strengthTrends(workouts: readonly WorkoutRecord[], limit = 3): StrengthTrend[] {
  const byExercise = new Map<string, { sets: number; best: Map<string, number> }>();
  for (const workout of workouts) {
    if (!finished(workout)) continue;
    for (const set of workout.sets) {
      const value = set.loadGrams && set.reps ? estimatedOneRepMaxKg(set.loadGrams, set.reps) : undefined;
      if (value === undefined) continue;
      const row = byExercise.get(set.exerciseId) ?? { sets: 0, best: new Map<string, number>() };
      row.sets++; row.best.set(workout.localDate, Math.max(row.best.get(workout.localDate) ?? 0, value));
      byExercise.set(set.exerciseId, row);
    }
  }
  return [...byExercise.entries()].sort((a, b) => b[1].sets - a[1].sets || a[0].localeCompare(b[0])).slice(0, limit)
    .map(([exerciseId, row]) => ({ exerciseId, sets: row.sets, ...trend([...row.best.entries()].map(([date, value]) => ({ date, value }))) }));
}

export const monthKey = (date: string) => date.slice(0, 7);
export function previousMonth(month: string) { const [y, m] = month.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; }
/** Finished sessions per month for the last `count` months ending with `month` (oldest first). */
export function sessionsByMonth(workouts: readonly WorkoutRecord[], month: string, count = 6): TrendPoint[] {
  const months: string[] = [month];
  while (months.length < count) months.unshift(previousMonth(months[0]));
  return months.map(key => ({ date: key, value: workouts.filter(workout => finished(workout) && monthKey(workout.localDate) === key).length }));
}
export interface MonthSummary { month: string; sessions: number; complete: number; minutes: number; sets: number; weightChange?: number }
const minutesOf = (workout: WorkoutRecord) => {
  const correction = (workout as WorkoutRecord & { timeCorrections?: { startedAt: string; endedAt: string }[] }).timeCorrections?.at(-1);
  const start = correction?.startedAt ?? workout.startedAt, end = correction?.endedAt ?? workout.endedAt;
  const value = end ? (Date.parse(end) - Date.parse(start)) / 60000 : 0;
  return Number.isFinite(value) && value > 0 && value < 12 * 60 ? value : 0;
};
export function monthSummary(workouts: readonly WorkoutRecord[], weights: readonly BodyWeightObservation[], month: string): MonthSummary {
  const rows = workouts.filter(workout => finished(workout) && monthKey(workout.localDate) === month);
  const weight = weightTrend(weights.filter(row => monthKey(row.localDate) === month));
  return {
    month, sessions: rows.length, complete: rows.filter(workout => workout.status === 'complete').length,
    minutes: Math.round(rows.reduce((sum, workout) => sum + minutesOf(workout), 0)), sets: rows.reduce((sum, workout) => sum + workout.sets.length, 0),
    weightChange: weight.change,
  };
}
