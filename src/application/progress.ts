import type { ProgressFacts, ProgressReport, ProgressMetrics, ProgressQuery, LocalDate, SetRecord } from '../domain/models';
import { DomainError } from '../domain/errors';
import { localDateSchema, timeZoneSchema } from '../domain/schemas';
import { repository, type Repository } from '../persistence/repository';

function metrics(): ProgressMetrics {
  return { reps: 0, loadGrams: 0, volumeGrams: 0, durationSeconds: 0, distanceMeters: null, missingDistanceSets: 0 };
}

function add(target: ProgressMetrics, set: SetRecord): void {
  target.reps += set.reps ?? 0;
  target.loadGrams += set.loadGrams ?? 0;
  target.volumeGrams += (set.reps ?? 0) * (set.loadGrams ?? 0);
  target.durationSeconds += set.durationSeconds ?? 0;
  if (set.distanceMeters !== undefined) target.distanceMeters = (target.distanceMeters ?? 0) + set.distanceMeters;
  else if (set.metricType === 'duration_distance') target.missingDistanceSets++;
}

export function dateInZone(nowMs: number, timeZone: string): LocalDate {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(nowMs);
  const part = (type: string) => parts.find(value => value.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function calculateProgress(input: ProgressFacts, cutoff: LocalDate): ProgressReport {
  if (!Number.isFinite(input.nowMs) || ![input.from, input.to, cutoff].every(date => localDateSchema.safeParse(date).success) || input.from > input.to) {
    throw new DomainError('INVALID', 'Invalid progress dates or clock');
  }
  const inRange = (date: LocalDate) => date >= input.from && date <= input.to && date <= cutoff;
  const completed = input.sessions.filter(session => session.status === 'completed');
  const due = input.scheduledWorkouts.filter(row => {
    if (input.planVersionId && row.planVersionId !== input.planVersionId) return false;
    const zone = input.planTimeZones[row.planVersionId];
    if (!zone || !timeZoneSchema.safeParse(zone).success) throw new DomainError('INVALID', 'Originating plan time zone is missing');
    return inRange(row.originalDate) && dateInZone(input.nowMs, zone) > row.originalDate;
  });
  const completedCount = due.filter(row => completed.some(session => session.id === row.completedSessionId && session.planVersionId === row.planVersionId && session.plannedDayId === row.plannedDayId)).length;
  const history = completed.filter(session => inRange(session.localDate) && (!input.planVersionId || session.planVersionId === input.planVersionId))
    .sort((a, b) => b.localDate.localeCompare(a.localDate) || b.startedAt.localeCompare(a.startedAt) || a.id.localeCompare(b.id));
  const historyIds = new Set(history.map(session => session.id));
  const historySets = input.sets.filter(set => historyIds.has(set.sessionId));
  const totals = metrics();
  const categories = new Map<string, ProgressReport['categoryTrends'][number]>();
  const exercisePoints = new Map<string, ProgressReport['exerciseTrends'][number]>();
  for (const session of history) {
    for (const set of historySets.filter(value => value.sessionId === session.id && value.completed)) {
      const exercise = session.exerciseSnapshots.find(value => value.exerciseInstanceId === set.exerciseInstanceId);
      if (!exercise) throw new DomainError('INVALID', 'Completed set exercise snapshot is missing');
      const categoryKey = `${session.localDate}:${exercise.category}`;
      const category = categories.get(categoryKey) ?? { ...metrics(), localDate: session.localDate, category: exercise.category };
      const exerciseKey = `${session.localDate}:${exercise.exerciseId}:${set.metricType}`;
      const point = exercisePoints.get(exerciseKey) ?? { ...metrics(), localDate: session.localDate, exerciseId: exercise.exerciseId, name: exercise.name, metricType: set.metricType };
      add(totals, set);
      add(category, set);
      add(point, set);
      categories.set(categoryKey, category);
      exercisePoints.set(exerciseKey, point);
    }
  }
  return {
    dueCount: due.length,
    completedCount,
    completionRate: due.length ? completedCount / due.length : null,
    history,
    historySets,
    historySchedules: input.scheduledWorkouts.filter(row => row.completedSessionId && historyIds.has(row.completedSessionId)),
    totals,
    categoryTrends: [...categories.values()].sort((a, b) => a.localDate.localeCompare(b.localDate) || a.category.localeCompare(b.category)),
    exerciseTrends: [...exercisePoints.values()].sort((a, b) => a.localDate.localeCompare(b.localDate) || a.exerciseId.localeCompare(b.exerciseId)),
    bodyWeights: input.bodyWeights.filter(row => inRange(row.localDate)).sort((a, b) => a.localDate.localeCompare(b.localDate)),
  };
}

export function createProgressService(repo: Repository) {
  async function queryProgress(input: ProgressQuery, nowMs: number): Promise<ProgressReport> {
    const db = repo.db;
    return db.transaction('r', [db.sessions, db.sets, db.scheduledWorkouts, db.bodyWeights, db.plans, db.planVersions], async () => {
      const [sessions, sets, scheduledWorkouts, bodyWeights, plans, versions] = await Promise.all([
        db.sessions.toArray(), db.sets.toArray(), db.scheduledWorkouts.toArray(), db.bodyWeights.toArray(), db.plans.toArray(), db.planVersions.toArray(),
      ]);
      const planTimeZones: Record<string, string> = {};
      for (const version of versions) {
        const plan = plans.find(value => value.id === version.planId);
        if (plan) planTimeZones[version.id] = plan.scheduleTimeZone;
      }
      return calculateProgress({ ...input, nowMs, planTimeZones, sessions, sets, scheduledWorkouts, bodyWeights }, input.to);
    });
  }
  return { queryProgress };
}

export const progressService = createProgressService(repository);
export const { queryProgress } = progressService;
