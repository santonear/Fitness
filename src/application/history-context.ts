import type { BodyWeightObservation, ExerciseSnapshot, Plan, PlanVersion, ScheduledWorkout, SetRecord, WorkoutSession } from '../domain/models';

export interface HistorySnapshot {
  capturedAt: string;
  dataRevision: number;
  restoreGeneration: number;
  plans: readonly Plan[];
  planVersions: readonly PlanVersion[];
  sessions: readonly WorkoutSession[];
  sets: readonly SetRecord[];
  scheduledWorkouts: readonly ScheduledWorkout[];
  bodyWeights: readonly BodyWeightObservation[];
}
export type HistorySource = 'sessions' | 'scheduledWorkouts' | 'bodyWeights';
export interface HistoryScope {
  from: string;
  to: string;
  sources: readonly HistorySource[];
  maxUtf8Bytes: number;
}
export interface HistoryPayload {
  format: 'fitness-history-context';
  version: 1;
  capturedAt: string;
  dataRevision: number;
  restoreGeneration: number;
  range: { from: string; to: string; sessionDate: 'actual'; scheduleDate: 'original' };
  sources: HistorySource[];
  plans: Plan[];
  planVersions: HistoryPlanVersion[];
  sessions: WorkoutSession[];
  sets: SetRecord[];
  scheduledWorkouts: ScheduledWorkout[];
  bodyWeights: BodyWeightObservation[];
}
export type HistoryPlanVersion = PlanVersion extends infer V ? V extends PlanVersion ? Omit<V, 'goalSnapshot' | 'generationMetadata'> : never : never;
export interface HistoryManifest {
  source: 'committed-entity-snapshot';
  version: 1;
  capturedAt: string;
  dataRevision: number;
  restoreGeneration: number;
  range: HistoryPayload['range'];
  sources: HistorySource[];
  selectedFields: typeof SELECTED_FIELDS;
  counts: Record<'plans' | 'planVersions' | 'sessions' | 'sets' | 'scheduledWorkouts' | 'bodyWeights', number>;
  sessionStatuses: Record<WorkoutSession['status'], number>;
  setStatuses: { completed: number; temporary: number };
  scheduleStatuses: { pending: number; skipped: number; hidden: number; linkedToCompletedSession: number };
  identities: Record<keyof HistoryManifest['counts'], string[]>;
  utf8Bytes: number;
  byteContract: 'UTF8(JSON.stringify(canonicalPayload)); manifest excluded';
}
export type HistoryContextResult =
  | { ok: true; payload: HistoryPayload; json: string; manifest: HistoryManifest }
  | { ok: false; reason: 'invalid_snapshot'; detail: string }
  | { ok: false; reason: 'over_budget'; requiredUtf8Bytes: number; maxUtf8Bytes: number; action: 'revise_scope' };

const ENTITY = ['id', 'createdAt', 'updatedAt', 'revision'] as const;
const SELECTED_FIELDS = {
  plans: [...ENTITY, 'name', 'source', 'status', 'currentVersionId', 'startDate', 'scheduleTimeZone', 'deletedAt', 'model'],
  planVersions: [...ENTITY, 'planId', 'versionNumber', 'model', 'startDate', 'scheduleTimeZone', 'days', 'durationWeeks', 'daysPerWeek'],
  sessions: [...ENTITY, 'planVersionId', 'plannedDayId', 'status', 'startedAt', 'completedAt', 'localDate', 'timeZone', 'originalExerciseSnapshots', 'exerciseSnapshots', 'notes'],
  sets: [...ENTITY, 'sessionId', 'exerciseInstanceId', 'order', 'metricType', 'reps', 'loadGrams', 'durationSeconds', 'distanceMeters', 'completed', 'notes'],
  scheduledWorkouts: [...ENTITY, 'planVersionId', 'plannedDayId', 'originalDate', 'scheduledDate', 'status', 'completedSessionId', 'hiddenAt'],
  bodyWeights: [...ENTITY, 'localDate', 'timeZone', 'weightGrams'],
  exerciseSnapshots: ['id', 'catalogVersion', 'name', 'category', 'equipment', 'metricType', 'allowedMetrics', 'exerciseInstanceId', 'exerciseId', 'order', 'targetSets', 'notes', 'originalExerciseId'],
  planDays: ['dayId', 'date', 'weekIndex', 'dayOfWeek', 'exercises'],
  plannedExercises: ['exerciseId', 'order', 'targetSets', 'notes'],
  targetSets: ['metricType', 'reps', 'loadGrams', 'durationSeconds', 'distanceMeters'],
} as const;

function pick<T>(value: T, fields: readonly string[]): T {
  return Object.fromEntries(fields.filter(key => (value as Record<string, unknown>)[key] !== undefined)
    .map(key => [key, (value as Record<string, unknown>)[key]])) as T;
}
function compare(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function byId<T extends { id: string }>(rows: T[]): T[] { return rows.sort((a, b) => compare(a.id, b.id)); }
function byOrder<T extends { order: number }>(rows: T[], identity: (row: T) => string): T[] {
  return rows.sort((a, b) => a.order - b.order || compare(identity(a), identity(b)));
}
// Canonical object keys and detached values; target-set array order is semantic and retained.
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value !== null && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([, child]) => child !== undefined).sort(([a], [b]) => compare(a, b)).map(([key, child]) => [key, canonical(child)]));
  return value;
}
function date(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
}
function exercise(value: ExerciseSnapshot): ExerciseSnapshot {
  return { ...pick(value, SELECTED_FIELDS.exerciseSnapshots), allowedMetrics: [...value.allowedMetrics].sort(compare), targetSets: value.targetSets.map(set => pick(set, SELECTED_FIELDS.targetSets)) };
}

/** Pure builder for a caller-captured committed snapshot. Does not capture, rebuild, persist or send history. */
export function buildHistoryContext(snapshot: HistorySnapshot, scope: HistoryScope): HistoryContextResult {
  const invalid = (detail: string): HistoryContextResult => ({ ok: false, reason: 'invalid_snapshot', detail });
  if (!date(scope.from) || !date(scope.to) || scope.from > scope.to) return invalid('Invalid inclusive date range');
  if (!Number.isSafeInteger(scope.maxUtf8Bytes) || scope.maxUtf8Bytes < 0) return invalid('Invalid byte budget');
  if (!Number.isFinite(Date.parse(snapshot.capturedAt)) || !Number.isSafeInteger(snapshot.dataRevision) || snapshot.dataRevision < 0 || !Number.isSafeInteger(snapshot.restoreGeneration) || snapshot.restoreGeneration < 0) return invalid('Invalid snapshot metadata');
  if (scope.sources.some(source => !['sessions', 'scheduledWorkouts', 'bodyWeights'].includes(source)) || new Set(scope.sources).size !== scope.sources.length) return invalid('Invalid explicit sources');
  for (const rows of [snapshot.plans, snapshot.planVersions, snapshot.sessions, snapshot.sets, snapshot.scheduledWorkouts, snapshot.bodyWeights]) {
    if (new Set(rows.map(row => row.id)).size !== rows.length) return invalid('Duplicate source identity');
  }
  const within = (value: string) => value >= scope.from && value <= scope.to;
  const sessions = byId(scope.sources.includes('sessions') ? snapshot.sessions.filter(row => within(row.localDate)).map(row => ({
    ...pick(row, SELECTED_FIELDS.sessions), exerciseSnapshots: byOrder(row.exerciseSnapshots.map(exercise), e => e.exerciseInstanceId),
    originalExerciseSnapshots: byOrder(row.originalExerciseSnapshots.map(exercise), e => e.exerciseInstanceId),
  })) : []);
  const sessionIds = new Set(sessions.map(row => row.id));
  const sets = byId(snapshot.sets.filter(row => sessionIds.has(row.sessionId)).map(row => pick(row, SELECTED_FIELDS.sets)));
  if (sets.some(row => !sessions.find(session => session.id === row.sessionId)?.exerciseSnapshots.some(exercise => exercise.exerciseInstanceId === row.exerciseInstanceId))) return invalid('Set has no selected exercise identity');
  const scheduledWorkouts = byId(scope.sources.includes('scheduledWorkouts') ? snapshot.scheduledWorkouts.filter(row => within(row.originalDate)).map(row => pick(row, SELECTED_FIELDS.scheduledWorkouts)) : []);
  const versionIds = new Set([...sessions.map(row => row.planVersionId), ...scheduledWorkouts.map(row => row.planVersionId)].filter((id): id is string => id !== undefined));
  const versions = snapshot.planVersions.filter(row => versionIds.has(row.id));
  if (versions.length !== versionIds.size) return invalid('Missing referenced plan version');
  const planIds = new Set(versions.map(row => row.planId));
  const plans = byId(snapshot.plans.filter(row => planIds.has(row.id)).map(row => pick(row, SELECTED_FIELDS.plans)));
  if (plans.length !== planIds.size) return invalid('Missing referenced plan identity');
  const references = [...sessions, ...scheduledWorkouts];
  if (references.some(reference => reference.plannedDayId !== undefined && !versions.find(version => version.id === reference.planVersionId)?.days.some(day => day.dayId === reference.plannedDayId))) return invalid('Missing referenced plan day');
  const planVersions = byId(versions.map(row => ({ ...pick(row, SELECTED_FIELDS.planVersions), days: row.days.filter(day => references.some(reference => reference.planVersionId === row.id && reference.plannedDayId === day.dayId)).map(day => ({
    ...pick(day, SELECTED_FIELDS.planDays), exercises: byOrder(day.exercises.map(item => ({ ...pick(item, SELECTED_FIELDS.plannedExercises), targetSets: item.targetSets.map(target => pick(target, SELECTED_FIELDS.targetSets)) })), item => item.exerciseId),
  })).sort((a, b) => compare(a.dayId, b.dayId)) })));
  const bodyWeights = byId(scope.sources.includes('bodyWeights') ? snapshot.bodyWeights.filter(row => within(row.localDate)).map(row => pick(row, SELECTED_FIELDS.bodyWeights)) : []);
  const payload = canonical({ format: 'fitness-history-context', version: 1, capturedAt: snapshot.capturedAt,
    dataRevision: snapshot.dataRevision, restoreGeneration: snapshot.restoreGeneration,
    range: { from: scope.from, to: scope.to, sessionDate: 'actual', scheduleDate: 'original' }, sources: [...scope.sources].sort(compare),
    plans, planVersions, sessions, sets, scheduledWorkouts, bodyWeights }) as HistoryPayload;
  const json = JSON.stringify(payload);
  const utf8Bytes = new TextEncoder().encode(json).byteLength;
  if (utf8Bytes > scope.maxUtf8Bytes) return { ok: false, reason: 'over_budget', requiredUtf8Bytes: utf8Bytes, maxUtf8Bytes: scope.maxUtf8Bytes, action: 'revise_scope' };
  const keys = ['plans', 'planVersions', 'sessions', 'sets', 'scheduledWorkouts', 'bodyWeights'] as const;
  const counts = Object.fromEntries(keys.map(key => [key, payload[key].length])) as HistoryManifest['counts'];
  const identities = Object.fromEntries(keys.map(key => [key, payload[key].map(row => row.id)])) as HistoryManifest['identities'];
  const sessionStatuses = { completed: 0, in_progress: 0, abandoned: 0 };
  sessions.forEach(row => sessionStatuses[row.status]++);
  return { ok: true, payload, json, manifest: { source: 'committed-entity-snapshot', version: 1,
    capturedAt: snapshot.capturedAt, dataRevision: snapshot.dataRevision, restoreGeneration: snapshot.restoreGeneration,
    range: { ...payload.range }, sources: [...payload.sources], selectedFields: structuredClone(SELECTED_FIELDS), counts, identities, sessionStatuses,
    setStatuses: { completed: sets.filter(row => row.completed).length, temporary: sets.filter(row => !row.completed).length },
    scheduleStatuses: { pending: scheduledWorkouts.filter(row => row.status === 'pending').length,
      skipped: scheduledWorkouts.filter(row => row.status === 'skipped').length, hidden: scheduledWorkouts.filter(row => row.hiddenAt !== undefined).length,
      linkedToCompletedSession: scheduledWorkouts.filter(row => row.completedSessionId !== undefined).length },
    utf8Bytes, byteContract: 'UTF8(JSON.stringify(canonicalPayload)); manifest excluded' } };
}
