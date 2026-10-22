import type { WorkoutRecord, LegacyWorkoutProjection } from '../../domain/v8/contracts';
import type { ReviewInput, ReviewFacts, ComputeWeekFacts, ComputeMonthFacts } from './contracts';
import { workoutSeconds } from '../workout-duration';
import { computeIncompleteTiming } from './evidence';
import { addDays, isLocalDate, todayIn, weekStart, utcDay } from '../../domain/local-date';

type Record = WorkoutRecord | LegacyWorkoutProjection;
const within = (date: string, from: string, to: string) => date >= from && date <= to;
const dateAt = (value: string, timeZone: string) => todayIn(timeZone, value);
function records(input: ReviewInput): Record[] {
  // One identity counts once. Native V8 facts win if a caller also supplies an old projection.
  return [...new Map([...input.legacyWorkouts ?? [], ...input.workouts].map(row => [row.id, row])).values()];
}
function check(input: ReviewInput) {
  for (const date of [input.from, input.to]) {
    if (!isLocalDate(date)) throw new Error('Invalid review date');
  }
  if (input.from > input.to || !Number.isInteger(input.weeklyTarget) || input.weeklyTarget < 1 || input.weeklyTarget > 7) throw new Error('Invalid review range or target');
}
const saved = (row: Record) => row.status === 'complete' || row.status === 'partial' || row.status === 'not_started';
const moved = (row: Record) => row.status === 'complete' || row.status === 'partial';
function maxima(rows: readonly Record[]) {
  const result = new Map<string, { exerciseId: string; metric: 'loadGrams' | 'reps' | 'durationSeconds'; value: number }>();
  for (const row of rows.filter(moved)) for (const set of row.sets) {
    for (const metric of ['loadGrams', 'reps', 'durationSeconds'] as const) {
      const value = set[metric];
      if (value === undefined || value === null || !Number.isFinite(value)) continue;
      const key = `${set.exerciseId}:${metric}`;
      if (!result.has(key) || value > result.get(key)!.value) result.set(key, { exerciseId: set.exerciseId, metric, value });
    }
  }
  return result;
}
function facts(input: ReviewInput, comparisonFrom: string, patternFrom = input.from): ReviewFacts {
  check(input);
  const all = records(input);
  const inRange = (row: Record) => within(dateAt(row.startedAt, input.timeZone), input.from, input.to);
  const current = all.filter(row => saved(row) && inRange(row));
  const planned = current.filter(row => row.planVersionId !== undefined);
  const activities = [...new Map(input.activities.map(row => [row.id, row])).values()].filter(row => within(row.localDate, input.from, input.to));
  const complete = planned.filter(row => row.status === 'complete').length;
  const partial = planned.filter(row => row.status === 'partial').length;
  const patterns = all.filter(row => row.planVersionId && within(dateAt(row.startedAt, input.timeZone), patternFrom, input.to)
    && (row.status === 'partial' || row.status === 'not_started'));
  const reasonCounts = { time: 0, fatigue: 0, discomfort: 0, equipment_busy: 0, not_today: 0, other: 0 };
  for (const row of patterns) for (const reason of new Set(row.feedback?.reasons ?? [])) reasonCounts[reason]++;
  const activityCounts = { walk: 0, run: 0, cycle: 0, swim: 0, yoga: 0, stairs: 0, other: 0 };
  for (const row of activities) activityCounts[row.type]++;
  const currentMax = maxima(current);
  const previousMax = maxima(all.filter(row => within(dateAt(row.startedAt, input.timeZone), comparisonFrom, addDays(input.from, -1))));
  const candidates = [...currentMax].flatMap(([key, value]) => {
    const previous = previousMax.get(key)?.value;
    return previous !== undefined && value.value > previous ? [{ exerciseId: value.exerciseId, metric: value.metric, previous, current: value.value }] : [];
  }).sort((a, b) => (b.current - b.previous) / Math.max(1, Math.abs(b.previous)) - (a.current - a.previous) / Math.max(1, Math.abs(a.previous))
    || a.exerciseId.localeCompare(b.exerciseId) || a.metric.localeCompare(b.metric));
  const improvements = candidates.filter((row, index) => candidates.findIndex(other => other.exerciseId === row.exerciseId) === index).slice(0, 2);
  return { from: input.from, to: input.to, complete, partial, notStarted: planned.filter(row => row.status === 'not_started').length,
    movementCount: current.filter(moved).length + activities.length, missingCount: Math.max(0, input.weeklyTarget - complete),
    activityMinutes: activities.reduce((sum, row) => sum + row.minutes, 0), activityCounts, reasonCounts,
    trainingSeconds: current.filter(moved).reduce((sum,row)=>sum+workoutSeconds(row.startedAt,row.endedAt),0), hasBodyWeight: input.bodyWeights.some(row => within(row.localDate, input.from, input.to)),
    incompleteTiming: computeIncompleteTiming(patterns,input.timeZone), improvements };
}
export const computeWeekFacts: ComputeWeekFacts = input => {
  const previousFrom = addDays(input.from, -7), previousTo = addDays(input.from, -1);
  const previous = facts({ ...input, from: previousFrom, to: previousTo }, addDays(previousFrom, -7));
  return { ...facts(input, previousFrom), previousMovementCount: previous.movementCount };
};
export const computeMonthFacts: ComputeMonthFacts = input => {
  const first = new Date(`${input.from}T00:00:00Z`);
  const priorMonth = utcDay(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() - 1, 1));
  const weeks: { from: string; complete: number; partial: number }[] = [];
  const all = records(input).filter(row => row.planVersionId && within(dateAt(row.startedAt, input.timeZone), input.from, input.to));
  for (let from = weekStart(input.from); from <= input.to; from = addDays(from, 7)) {
    const rows = all.filter(row => within(dateAt(row.startedAt, input.timeZone), from, addDays(from, 6)));
    weeks.push({ from, complete: rows.filter(row => row.status === 'complete').length, partial: rows.filter(row => row.status === 'partial').length });
  }
  const result = facts(input, priorMonth, input.from);
  return { ...result, missingCount: weeks.reduce((sum, week) => sum + Math.max(0, input.weeklyTarget - week.complete), 0), weeks };
};
