import { z } from 'zod';
import { bodyWeightObservationSchema, goalSnapshotSchema, legacyPlanVersionSchema, datePlanVersionSchema,
  localDateSchema, timeZoneSchema, planSchema, scheduledWorkoutSchema, setRecordSchema, utcTimestampSchema,
  uuidSchema, workoutSessionSchema, datePlanDaySchema } from '../domain/schemas';
import { buildHistoryContext, type HistorySnapshot } from '../application/history-context';
import { calculateProgress, dateInZone } from '../application/progress-calculation';
import { ControlError } from './store';
import { exercises } from '../catalog/exercises';

const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
export const stageSelectionSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('dateRange'), from: localDateSchema, to: localDateSchema, timeZone: timeZoneSchema }),
  z.strictObject({ kind: z.literal('planWeek'), planId: uuidSchema, from: localDateSchema, timeZone: timeZoneSchema }),
  z.strictObject({ kind: z.literal('wholePlan'), planId: uuidSchema, timeZone: timeZoneSchema }),
]);
const { goalSnapshot: _goal, generationMetadata: _generation, ...legacyFields } = legacyPlanVersionSchema.shape;
const { goalSnapshot: _dateGoal, generationMetadata: _dateGeneration, ...dateFields } = datePlanVersionSchema.shape;
const historyVersion = z.union([z.strictObject(legacyFields), z.strictObject({ ...dateFields,
  days: z.array(datePlanDaySchema) })]);
const range = z.strictObject({ from: localDateSchema, to: localDateSchema, timeZone: timeZoneSchema });
export const summaryStageSchema = z.strictObject({ selection: stageSelectionSchema, range, sourceRevision: count,
  capturedAt: utcTimestampSchema,
  payload: z.strictObject({ format: z.literal('fitness-history-context'), version: z.literal(1), capturedAt: utcTimestampSchema,
    dataRevision: count, restoreGeneration: count,
    range: z.strictObject({ from: localDateSchema, to: localDateSchema, sessionDate: z.literal('actual'), scheduleDate: z.literal('original') }),
    sources: z.array(z.enum(['sessions', 'scheduledWorkouts', 'bodyWeights'])), plans: z.array(planSchema),
    planVersions: z.array(historyVersion), sessions: z.array(workoutSessionSchema), sets: z.array(setRecordSchema),
    scheduledWorkouts: z.array(scheduledWorkoutSchema), bodyWeights: z.array(bodyWeightObservationSchema) }),
  goals: z.array(z.strictObject({ planId: uuidSchema, planVersionId: uuidSchema, goal: goalSnapshotSchema })),
  completionLinks: z.array(z.strictObject({ taskId: uuidSchema, sessionId: uuidSchema, planVersionId: uuidSchema, plannedDayId: uuidSchema })),
});
export type SummaryStage = z.infer<typeof summaryStageSchema>;
export const summaryResultSchema = z.strictObject({ summary: z.string().min(1).max(8000),
  nextStageAdvice: z.array(z.string().min(1).max(2000)).max(8) });

/** Verifies only transmitted committed facts; never reads a database or trusts claimed aggregates. */
export function validateSummaryStage(stage: SummaryStage, restoreGeneration: number) {
  const invalid = () => { throw new ControlError('INVALID_INPUT', 400); };
  const { payload, selection } = stage;
  if (stage.range.from > stage.range.to || selection.timeZone !== stage.range.timeZone ||
    payload.range.from !== stage.range.from || payload.range.to !== stage.range.to ||
    payload.dataRevision !== stage.sourceRevision || payload.capturedAt !== stage.capturedAt || payload.restoreGeneration !== restoreGeneration) invalid();
  if (selection.kind === 'dateRange' && (selection.from !== stage.range.from || selection.to !== stage.range.to)) invalid();
  if (selection.kind === 'planWeek') {
    const end = new Date(`${selection.from}T00:00:00Z`); end.setUTCDate(end.getUTCDate() + 6);
    if (selection.from !== stage.range.from || end.toISOString().slice(0, 10) !== stage.range.to) invalid();
  }
  if (payload.sources.length !== 3 || new Set(payload.sources).size !== 3) invalid();
  if (payload.sessions.some(row => row.status !== 'completed') || payload.sets.some(row => !row.completed)) invalid();
  const goals = new Map(stage.goals.map(row => [row.planVersionId, row]));
  if (goals.size !== stage.goals.length) invalid();
  const versions = payload.planVersions.map(version => {
    const goal = goals.get(version.id); if (!goal || goal.planId !== version.planId) invalid();
    return { ...version, goalSnapshot: goal!.goal };
  });
  for (const version of versions) {
    if (new Set(version.days.map(day => day.dayId)).size !== version.days.length) invalid();
    if (!('durationWeeks' in version) && (version.days.length !== 1 || version.days[0].date !== version.startDate)) invalid();
    for (const day of version.days) {
      if (new Set(day.exercises.map(item => item.order)).size !== day.exercises.length) invalid();
      for (const item of day.exercises) if (item.targetSets.some(target => target.metricType !== exercises.find(row => row.id === item.exerciseId)!.metricType)) invalid();
    }
  }
  if (selection.kind !== 'dateRange' && (payload.plans.some(plan => plan.id !== selection.planId) ||
    payload.sessions.some(session => !session.planVersionId) || versions.some(version => version.planId !== selection.planId) ||
    stage.goals.some(goal => goal.planId !== selection.planId))) invalid();
  if (selection.kind === 'dateRange' && stage.goals.some(goal => !versions.some(version => version.id === goal.planVersionId))) invalid();
  for (const session of payload.sessions) {
    if (!session.completedAt || Date.parse(session.completedAt) < Date.parse(session.startedAt)) invalid();
    for (const snapshots of [session.exerciseSnapshots, session.originalExerciseSnapshots]) {
      if (new Set(snapshots.map(item => item.exerciseInstanceId)).size !== snapshots.length || new Set(snapshots.map(item => item.order)).size !== snapshots.length) invalid();
      for (const item of snapshots) {
        const catalog = exercises.find(row => row.id === item.exerciseId)!;
        if (item.id !== item.exerciseId || item.catalogVersion !== catalog.catalogVersion || item.metricType !== catalog.metricType ||
          item.category !== catalog.category || item.equipment !== catalog.equipment ||
          JSON.stringify([...item.allowedMetrics].sort()) !== JSON.stringify([...catalog.allowedMetrics].sort()) ||
          item.targetSets.some(target => target.metricType !== item.metricType)) invalid();
      }
    }
    if ((session.planVersionId === undefined) !== (session.plannedDayId === undefined)) invalid();
    const rows = payload.sets.filter(set => set.sessionId === session.id);
    if (!rows.length || new Set(rows.map(set => `${set.exerciseInstanceId}:${set.order}`)).size !== rows.length) invalid();
  }
  for (const set of payload.sets) {
    const session = payload.sessions.find(row => row.id === set.sessionId);
    const exercise = session?.exerciseSnapshots.find(row => row.exerciseInstanceId === set.exerciseInstanceId);
    if (!exercise || exercise.metricType !== set.metricType) invalid();
  }
  const taskKeys = payload.scheduledWorkouts.map(task => `${task.planVersionId}:${task.plannedDayId}`);
  const completedIds = payload.scheduledWorkouts.flatMap(task => task.completedSessionId ? [task.completedSessionId] : []);
  if (new Set(taskKeys).size !== taskKeys.length || new Set(completedIds).size !== completedIds.length) invalid();
  for (const task of payload.scheduledWorkouts) {
    const version = versions.find(row => row.id === task.planVersionId);
    const day = version?.days.find(row => row.dayId === task.plannedDayId);
    if (!day || !version || (task.completedSessionId && task.status !== 'pending')) invalid();
    if (version && !('durationWeeks' in version) && task.originalDate !== version.startDate) invalid();
    if (version && 'durationWeeks' in version && day && 'weekIndex' in day) {
      const days = (Date.parse(`${task.originalDate}T00:00:00Z`) - Date.parse(`${version.startDate}T00:00:00Z`)) / 86400000;
      if (days < (day.weekIndex - 1) * 7 || days >= day.weekIndex * 7 || (new Date(`${task.originalDate}T00:00:00Z`).getUTCDay() || 7) !== day.dayOfWeek) invalid();
    }
    const session = payload.sessions.find(row => row.id === task.completedSessionId);
    if (session && (session.planVersionId !== task.planVersionId || session.plannedDayId !== task.plannedDayId)) invalid();
  }
  if (new Set(stage.completionLinks.map(link => link.taskId)).size !== stage.completionLinks.length) invalid();
  for (const link of stage.completionLinks) {
    const task = payload.scheduledWorkouts.find(row => row.id === link.taskId);
    if (!task || task.completedSessionId !== link.sessionId || task.planVersionId !== link.planVersionId || task.plannedDayId !== link.plannedDayId ||
      payload.sessions.some(row => row.id === link.sessionId)) invalid();
  }
  const snapshot: HistorySnapshot = { capturedAt: stage.capturedAt, dataRevision: stage.sourceRevision, restoreGeneration,
    // History versions intentionally retain only referenced days, rather than entire templates.
    plans: payload.plans, planVersions: versions as HistorySnapshot['planVersions'], sessions: payload.sessions, sets: payload.sets,
    scheduledWorkouts: payload.scheduledWorkouts, bodyWeights: payload.bodyWeights };
  const rebuilt = buildHistoryContext(snapshot, { from: stage.range.from, to: stage.range.to,
    sources: payload.sources, maxUtf8Bytes: Number.MAX_SAFE_INTEGER });
  if (!rebuilt.ok || JSON.stringify(rebuilt.payload) !== JSON.stringify(sortKeys(payload))) invalid();
  if (!payload.sessions.length && !payload.bodyWeights.length) throw new ControlError('EMPTY_STAGE', 400);
  const report = calculateProgress({ ...stage.range, nowMs: Date.parse(stage.capturedAt),
    planTimeZones: Object.fromEntries(versions.map(version => [version.id, version.scheduleTimeZone])),
    sessions: payload.sessions, sets: payload.sets, scheduledWorkouts: payload.scheduledWorkouts, bodyWeights: payload.bodyWeights }, stage.range.to);
  const dueLinked = payload.scheduledWorkouts.filter(task => {
    const zone = versions.find(version => version.id === task.planVersionId)!.scheduleTimeZone;
    const today = dateInZone(Date.parse(stage.capturedAt), zone);
    return today > task.originalDate && stage.completionLinks.some(link => link.taskId === task.id);
  }).length;
  report.completedCount += dueLinked;
  report.completionRate = report.dueCount ? report.completedCount / report.dueCount : null;
  const completionReferencesComplete = payload.scheduledWorkouts.every(task => !task.completedSessionId ||
    payload.sessions.some(session => session.id === task.completedSessionId) || stage.completionLinks.some(link => link.taskId === task.id));
  if (!completionReferencesComplete) invalid();
  return { report, completionReferencesComplete };
}
function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => [key, sortKeys(item)]));
  return value;
}
