import type { BackupEnvelope, ExerciseSnapshot, ImportReport, PlanVersion, ReplaceConfirmation, SetRecord, ValidatedBackup, WorkoutSession } from '../domain/models';
import { backupEnvelopeSchema } from '../domain/schemas';
import { DomainError } from '../domain/errors';
import { exercises } from '../catalog/exercises';
import { expandSchedule } from '../domain/calendar';
import { repository, type Repository } from '../persistence/repository';
import { synchronizeTrainingMemo } from './training-memory';

export const MAX_BACKUP_BYTES = 10 * 1024 * 1024;
export const restoreChannelName = 'fitness-library-replaced';
export function restoreStorageKey(databaseName: string): string {
  return `${restoreChannelName}:${databaseName}`;
}

function invalid(message: string): never {
  throw new DomainError('BACKUP_REFERENCE_INVALID', message);
}
function distinct(values: string[], label: string): void {
  if (new Set(values).size !== values.length) invalid(`Duplicate ${label}`);
}
function validDate(value: string): void {
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) invalid('Impossible calendar date');
}
function validateSnapshot(snapshot: ExerciseSnapshot): void {
  const catalog = exercises.find(exercise => exercise.id === snapshot.exerciseId);
  if (!catalog || snapshot.id !== snapshot.exerciseId || snapshot.catalogVersion !== catalog.catalogVersion ||
      snapshot.category !== catalog.category || snapshot.equipment !== catalog.equipment || snapshot.metricType !== catalog.metricType ||
      JSON.stringify(snapshot.allowedMetrics) !== JSON.stringify(catalog.allowedMetrics) ||
      snapshot.targetSets.some(target => target.metricType !== catalog.metricType)) invalid('Exercise snapshot does not match catalog metrics');
}
function validateVersion(version: PlanVersion, startDate: string, timeZone: string): void {
  try { expandSchedule(version, startDate, timeZone); }
  catch { invalid('Invalid plan calendar'); }
  for (const day of version.days) {
    distinct(day.exercises.map(exercise => String(exercise.order)), 'planned exercise order');
    for (const exercise of day.exercises) {
      const catalog = exercises.find(entry => entry.id === exercise.exerciseId);
      if (!catalog || exercise.targetSets.some(target => target.metricType !== catalog.metricType)) invalid('Plan target metrics do not match catalog');
    }
  }
}
function validateSession(session: WorkoutSession, sets: SetRecord[], versions: Map<string, PlanVersion>): void {
  validDate(session.localDate);
  if ((session.status === 'completed') !== (session.completedAt !== undefined)) invalid('Workout completion timestamp does not match status');
  if (session.completedAt && Date.parse(session.completedAt) < Date.parse(session.startedAt)) invalid('Workout completes before it starts');
  if ((session.planVersionId === undefined) !== (session.plannedDayId === undefined)) invalid('Workout plan references must appear together');
  if (session.planVersionId && !versions.get(session.planVersionId)?.days.some(day => day.dayId === session.plannedDayId)) invalid('Workout plan day not found');
  for (const snapshots of [session.originalExerciseSnapshots, session.exerciseSnapshots]) {
    distinct(snapshots.map(exercise => exercise.exerciseInstanceId), 'exercise instance');
    distinct(snapshots.map(exercise => String(exercise.order)), 'exercise order');
    snapshots.forEach(validateSnapshot);
  }
  distinct(sets.map(set => set.id), 'set ID');
  distinct(sets.map(set => `${set.exerciseInstanceId}:${set.order}`), 'set order');
  for (const set of sets) {
    const exercise = session.exerciseSnapshots.find(snapshot => snapshot.exerciseInstanceId === set.exerciseInstanceId);
    if (set.sessionId !== session.id || !exercise || exercise.metricType !== set.metricType) invalid('Set workout or exercise reference is invalid');
  }
  if (session.status === 'completed' && !sets.some(set => set.completed)) invalid('Completed workout has no completed set');
}

export function validateBackupEnvelope(value: unknown): BackupEnvelope {
  if (typeof value === 'object' && value !== null && 'schemaVersion' in value && value.schemaVersion !== 2) {
    throw new DomainError('BACKUP_VERSION_UNSUPPORTED', 'Unsupported JSON backup version; only schema version 2 is supported');
  }
  const parsed = backupEnvelopeSchema.safeParse(value);
  if (!parsed.success) throw new DomainError('BACKUP_INVALID', `Invalid backup: ${parsed.error.message}`);
  const envelope = parsed.data;
  const data = envelope.data;
  if (envelope.catalogVersion !== 1 || data.metadata.catalogVersion !== 1 || data.metadata.schemaVersion !== 2 || data.trainingMemo.schemaVersion !== 1) {
    throw new DomainError('BACKUP_VERSION_UNSUPPORTED', 'Unsupported catalog, metadata or memo version');
  }
  for (const [label, rows] of Object.entries(data)) {
    if (Array.isArray(rows)) distinct(rows.map(row => row.id), `${label} ID`);
  }
  if (data.profiles.length !== 1 || data.profiles[0].id !== data.metadata.localProfileId) invalid('Exactly one matching local profile is required');
  if (data.plans.filter(plan => plan.status === 'active').length > 1) invalid('Multiple current plans');
  if (data.sessions.filter(session => session.status === 'in_progress').length > 1) invalid('Multiple ongoing workouts');
  const plans = new Map(data.plans.map(plan => [plan.id, plan]));
  const versions = new Map(data.planVersions.map(version => [version.id, version]));
  const sessions = new Map(data.sessions.map(session => [session.id, session]));
  for (const plan of data.plans) {
    validDate(plan.startDate);
    if (versions.get(plan.currentVersionId)?.planId !== plan.id) invalid('Current plan version not found');
  }
  distinct(data.planVersions.map(version => `${version.planId}:${version.versionNumber}`), 'plan version number');
  for (const version of data.planVersions) {
    const plan = plans.get(version.planId);
    if (!plan) invalid('Plan version parent not found');
    validateVersion(version, plan.startDate, plan.scheduleTimeZone);
  }
  for (const set of data.sets) if (!sessions.has(set.sessionId)) invalid('Set workout not found');
  for (const session of data.sessions) validateSession(session, data.sets.filter(set => set.sessionId === session.id), versions);
  distinct(data.scheduledWorkouts.map(row => `${row.planVersionId}:${row.plannedDayId}`), 'scheduled plan day');
  distinct(data.scheduledWorkouts.flatMap(row => row.completedSessionId ? [row.completedSessionId] : []), 'completed schedule workout');
  for (const row of data.scheduledWorkouts) {
    validDate(row.originalDate);
    validDate(row.scheduledDate);
    const version = versions.get(row.planVersionId);
    const day = version?.days.find(entry => entry.dayId === row.plannedDayId);
    if (!version || !day) invalid('Scheduled plan day not found');
    const weekday = new Date(`${row.originalDate}T00:00:00Z`).getUTCDay() || 7;
    if (weekday !== day.dayOfWeek) invalid('Original schedule date does not match plan weekday');
    const plan = plans.get(version.planId)!;
    if (plan.currentVersionId === version.id) {
      const original = expandSchedule(version, plan.startDate, plan.scheduleTimeZone).find(entry => entry.plannedDayId === row.plannedDayId);
      if (original?.originalDate !== row.originalDate) invalid('Original schedule date does not match plan calendar');
    }
    if (row.completedSessionId) {
      const session = sessions.get(row.completedSessionId);
      if (!session || session.status !== 'completed' || session.planVersionId !== row.planVersionId || session.plannedDayId !== row.plannedDayId || row.status !== 'pending') invalid('Completed schedule reference is invalid');
    }
  }
  for (const version of data.planVersions) {
    const rows = data.scheduledWorkouts.filter(row => row.planVersionId === version.id);
    if (rows.length !== version.days.length) invalid('Plan schedule is incomplete');
    // Historical versions keep their calendar when the plan's current start date changes.
    const dates = rows.map(row => {
      const day = version.days.find(entry => entry.dayId === row.plannedDayId)!;
      return Date.parse(`${row.originalDate}T00:00:00Z`) - (day.weekIndex - 1) * 7 * 86_400_000;
    });
    if (Math.max(...dates) - Math.min(...dates) >= 7 * 86_400_000) invalid('Schedule dates do not match cycle weeks');
  }
  for (const session of data.sessions) {
    if (session.status === 'completed' && session.planVersionId && !data.scheduledWorkouts.some(row => row.completedSessionId === session.id)) invalid('Completed planned workout has no schedule link');
  }
  distinct(data.bodyWeights.map(row => row.localDate), 'weight observation date');
  data.bodyWeights.forEach(row => validDate(row.localDate));
  distinct(data.timers.map(timer => `${timer.sessionId}:${timer.exerciseInstanceId}:${timer.kind}`), 'timer association');
  for (const timer of data.timers) {
    const session = sessions.get(timer.sessionId);
    if (!session || !timer.exerciseInstanceId || !session.exerciseSnapshots.some(exercise => exercise.exerciseInstanceId === timer.exerciseInstanceId)) invalid('Timer workout or exercise not found');
    if ((timer.status === 'running') !== (timer.startedAtMs !== undefined) || (timer.kind === 'rest' && !timer.targetMs)) invalid('Timer state does not match status or kind');
  }
  distinct(data.trainingMemo.sessions.map(entry => entry.session.id), 'memo workout');
  distinct(data.trainingMemo.sessions.flatMap(entry => entry.sets.map(set => set.id)), 'memo set ID');
  if (data.trainingMemo.sessions.filter(entry => entry.session.status === 'in_progress').length > 1) invalid('Multiple ongoing memo workouts');
  for (const entry of data.trainingMemo.sessions) {
    const memoVersions = new Map(versions);
    if (entry.planVersionSnapshot) {
      if (entry.planVersionSnapshot.id !== entry.session.planVersionId) invalid('Memo plan version mismatch');
      const plan = plans.get(entry.planVersionSnapshot.planId);
      if (!plan || !versions.has(entry.planVersionSnapshot.id)) invalid('Memo plan provenance not found');
      validateVersion(entry.planVersionSnapshot, plan.startDate, plan.scheduleTimeZone);
      memoVersions.set(entry.planVersionSnapshot.id, entry.planVersionSnapshot);
    }
    validateSession(entry.session, entry.sets, memoVersions);
  }
  for (const asset of data.mediaAssets) {
    if (asset.url && !['http:', 'https:'].includes(new URL(asset.url).protocol)) invalid('Media binary or local URL cannot be backed up');
  }
  return envelope;
}

export function createBackupService(repo: Repository) {
  async function exportBackup(): Promise<Blob> {
    const envelope = await repo.db.transaction('r', repo.db.tables, async () => {
      const metadata = await repo.readMetadata();
      const sessions = await repo.db.sessions.toArray();
      const sets = await repo.db.sets.toArray();
      const versions = await repo.db.planVersions.toArray();
      const previousMemo = await repo.db.trainingMemo.get(1);
      return validateBackupEnvelope({
        format: 'fitness-local', schemaVersion: 2, catalogVersion: 1, exportedAt: new Date().toISOString(),
        data: {
          metadata, profiles: await repo.db.profiles.toArray(), plans: await repo.db.plans.toArray(), planVersions: versions,
          sessions, sets, scheduledWorkouts: await repo.db.scheduledWorkouts.toArray(), bodyWeights: await repo.db.bodyWeights.toArray(),
          aiMemoryNotes: await repo.db.aiMemoryNotes.toArray(), timers: await repo.db.timers.toArray(), mediaAssets: await repo.db.mediaAssets.toArray(),
          trainingMemo: {
            schemaVersion: 1, revision: previousMemo?.revision ?? 0, sourceRevision: metadata.dataRevision, updatedAt: new Date().toISOString(),
            sessions: sessions.map(session => ({ session, sets: sets.filter(set => set.sessionId === session.id).sort((a, b) => a.order - b.order),
              ...(session.planVersionId ? { planVersionSnapshot: versions.find(version => version.id === session.planVersionId) } : {}) })),
          },
        },
      });
    });
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    if (blob.size > MAX_BACKUP_BYTES) throw new DomainError('BACKUP_TOO_LARGE', 'Export exceeds 10 MB. The configured import limit must be increased before creating a recoverable backup.');
    return blob;
  }

  async function validateBackup(file: File): Promise<ValidatedBackup> {
    if (file.size > MAX_BACKUP_BYTES) throw new DomainError('BACKUP_TOO_LARGE', 'Backup exceeds the 10 MB import limit');
    let value: unknown;
    try { value = JSON.parse(await file.text()); }
    catch { throw new DomainError('BACKUP_INVALID', 'Backup is not valid JSON'); }
    return { envelope: validateBackupEnvelope(value), expectedRevision: (await repo.readMetadata()).dataRevision };
  }

  async function importBackup(input: ValidatedBackup, confirmation: ReplaceConfirmation): Promise<ImportReport> {
    if (!confirmation.backupExported || !confirmation.replacementConfirmed || confirmation.expectedRevision !== input.expectedRevision) {
      throw new DomainError('BACKUP_CONFIRMATION_REQUIRED', 'Download and keep the current backup, then confirm complete replacement');
    }
    const envelope = validateBackupEnvelope(input.envelope);
    if (new Blob([JSON.stringify(envelope)]).size > MAX_BACKUP_BYTES) throw new DomainError('BACKUP_TOO_LARGE', 'Backup exceeds the 10 MB import limit');
    let committedGeneration = 0;
    await repo.write(async () => {
      const before = await repo.readMetadata();
      committedGeneration = (before.restoreGeneration ?? 0) + 1;
      if (!Number.isSafeInteger(committedGeneration) || !Number.isSafeInteger(before.dataRevision + 1)) invalid('Local revision counter exhausted');
      for (const table of repo.db.tables) await table.clear();
      const data = envelope.data;
      await repo.db.metadata.put({ ...data.metadata, revision: before.revision, dataRevision: before.dataRevision, restoreGeneration: committedGeneration, importedAt: new Date().toISOString() });
      await repo.db.profiles.bulkAdd(data.profiles);
      await repo.db.plans.bulkAdd(data.plans);
      await repo.db.planVersions.bulkAdd(data.planVersions);
      await repo.db.sessions.bulkAdd(data.sessions);
      await repo.db.sets.bulkAdd(data.sets);
      await repo.db.scheduledWorkouts.bulkAdd(data.scheduledWorkouts);
      await repo.db.bodyWeights.bulkAdd(data.bodyWeights);
      await repo.db.aiMemoryNotes.bulkAdd(data.aiMemoryNotes);
      await repo.db.timers.bulkAdd(data.timers);
      await repo.db.mediaAssets.bulkAdd(data.mediaAssets);
      await repo.db.trainingMemo.put(data.trainingMemo);
      await synchronizeTrainingMemo(repo);
    }, input.expectedRevision);
    repo.adoptGeneration(committedGeneration);
    try {
      localStorage.setItem(restoreStorageKey(repo.db.name), JSON.stringify({ generation: committedGeneration, eventId: crypto.randomUUID() }));
    } catch { /* BroadcastChannel and the same-tab reload remain available without localStorage. */ }
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(restoreChannelName);
      channel.postMessage({ databaseName: repo.db.name, generation: committedGeneration });
      channel.close();
    }
    return { importedPlans: envelope.data.plans.length, importedSessions: envelope.data.sessions.length, rebuiltMemo: true };
  }
  return { exportBackup, validateBackup, importBackup };
}

export const backupService = createBackupService(repository);
export const { exportBackup, validateBackup, importBackup } = backupService;
