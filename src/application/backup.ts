import type { BackupEnvelope, ExerciseSnapshot, ImportReport, PlanVersion, ReplaceConfirmation, SetRecord, ValidatedBackup, WorkoutSession } from '../domain/models';
import { backupEnvelopeSchema } from '../domain/schemas';
import { DomainError } from '../domain/errors';
import { exercises } from '../catalog/exercises';
import { expandSchedule } from '../domain/calendar';
import { repository, type Repository } from '../persistence/repository';
import { synchronizeTrainingMemo } from './training-memory';
import { projectDay } from '../domain/day-date-projection';
import { prepareV8Migration, writeV8Library } from '../persistence/v8-migration';
import Dexie from 'dexie';

// UTF-8 file bytes, not characters. Candidate verified on synthetic desktop data;
// physical-phone capacity support remains unverified.
export const MAX_BACKUP_BYTES = 16 * 1024 * 1024;
function checkBackupBytes(bytes: number): void {
  if (bytes > MAX_BACKUP_BYTES) throw new DomainError('BACKUP_TOO_LARGE', `Backup exceeds ${MAX_BACKUP_BYTES} UTF-8 bytes (16 MiB). Existing data has not been replaced.`);
}
export const restoreChannelName = 'fitness-library-replaced';
export const restoreEventName = 'fitness-library-restored';
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
function validateVersion(version: PlanVersion): void {
  validDate(version.startDate);
  try { if ('durationWeeks' in version) expandSchedule(version, version.startDate, version.scheduleTimeZone); }
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
  // Historical clock anomalies remain exportable; V8 duration statistics exclude them.
  if ((session.planVersionId === undefined) !== (session.plannedDayId === undefined)) invalid('Workout plan references must appear together');
  if (session.planVersionId && !versions.get(session.planVersionId)?.days.some(day => day.dayId === session.plannedDayId)) invalid('Workout plan day not found');
  const version = session.planVersionId ? versions.get(session.planVersionId) : undefined;
  if (version && !('durationWeeks' in version)) {
    const day = version.days[0];
    if (session.originalExerciseSnapshots.length !== day.exercises.length || day.exercises.some(item => {
      const original = session.originalExerciseSnapshots.find(snapshot => snapshot.order === item.order);
      return !original || original.exerciseId !== item.exerciseId || JSON.stringify(original.targetSets) !== JSON.stringify(item.targetSets) || original.notes !== item.notes;
    })) invalid('Day training original snapshot differs from its fixed version');
  }
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
  if (typeof value === 'object' && value !== null && 'schemaVersion' in value && value.schemaVersion !== 2 && value.schemaVersion !== 3 && value.schemaVersion !== 4 && value.schemaVersion !== 5 && value.schemaVersion !== 6) {
    throw new DomainError('BACKUP_VERSION_UNSUPPORTED', 'Unsupported JSON backup version; versions 2 through 6 are supported');
  }
  const parsed = backupEnvelopeSchema.safeParse(value);
  if (!parsed.success) throw new DomainError('BACKUP_INVALID', `Invalid backup: ${parsed.error.message}`);
  const envelope = parsed.data;
  const data = envelope.data;
  if (envelope.schemaVersion >= 4 && !data.guidedStates) invalid('Guided state collection is required in backup versions 4 and 5');
  if (envelope.schemaVersion < 4 && data.guidedStates?.length) invalid('Guided state requires backup version 4');
  if (envelope.catalogVersion !== 1 || data.metadata.catalogVersion !== 1 || data.metadata.schemaVersion !== (envelope.schemaVersion === 6 ? 8 : envelope.schemaVersion + 1) || data.trainingMemo.schemaVersion !== 1) {
    throw new DomainError('BACKUP_VERSION_UNSUPPORTED', 'Unsupported catalog, metadata or memo version');
  }
  if (envelope.schemaVersion === 6 && !data.v8 || envelope.schemaVersion < 6 && data.v8) invalid('V8 collections require backup version 6');
  if (data.v8) {
    const library = data.v8;
    const v8Plans = new Map(library.plans.map(plan => [plan.id, plan]));
    const v8Versions = new Map(library.planVersions.map(version => [version.id, version]));
    for (const [label, rows] of Object.entries(library)) if (Array.isArray(rows)) distinct(rows.map(row => row.id), `V8 ${label}`);
    if (library.state.currentPlanId && !v8Plans.has(library.state.currentPlanId)) invalid('V8 current plan missing');
    const override = library.state.nextWorkoutOverride;
    if (override) {
      const current = library.state.currentPlanId ? v8Plans.get(library.state.currentPlanId) : undefined;
      if (current?.currentVersionId !== override.planVersionId || !v8Versions.get(override.planVersionId)?.templates.some(t => t.id === override.templateId)) invalid('V8 next workout override target missing');
    }
    if (library.plans.some(plan => v8Versions.get(plan.currentVersionId)?.planId !== plan.id || plan.readOnly !== (plan.id !== library.state.currentPlanId))) invalid('V8 current version or read-only state invalid');
    for (const version of library.planVersions) {
      if (!v8Plans.has(version.planId)) invalid('V8 version parent missing');
      distinct(version.templates.map(template => template.id), 'V8 template');
      if (version.origin === 'migrated' && !data.planVersions.some(original => original.id === version.basedOnVersionId && original.planId === version.planId)) invalid('V8 migration source missing');
    }
    distinct(library.planVersions.map(version => `${version.planId}:${version.versionNumber}`), 'V8 version number');
    for (const workout of library.workouts) {
      const version = workout.planVersionId ? v8Versions.get(workout.planVersionId) : undefined;
      if (workout.planVersionId && !version || workout.templateId && !version?.templates.some(template => template.id === workout.templateId)) invalid('V8 workout plan or template missing');
      if (workout.templateSnapshot && (!version || workout.templateSnapshot.items.reduce((sum,item)=>sum+item.sets,0)!==workout.plannedSetCount || workout.templateSnapshot.items.some((item,index)=>workout.plannedExercises?.[index]?.exerciseId!==item.exerciseId || workout.plannedExercises?.[index]?.plannedSetCount!==item.sets))) invalid('V8 workout snapshot mismatch');
      validDate(workout.localDate);
    }
    library.activities.forEach(activity => validDate(activity.localDate));
    if (library.state.legacyPlanIds.some(id => !data.plans.some(plan => plan.id === id))) invalid('V8 retained legacy plan missing');
  }
  for (const [label, rows] of Object.entries(data)) {
    if (Array.isArray(rows)) distinct(rows.map(row => row.id), `${label} ID`);
  }
  if (data.profiles.length !== 1 || data.profiles[0].id !== data.metadata.localProfileId) invalid('Exactly one matching local profile is required');
  if (data.plans.filter(plan => !plan.model && plan.status === 'active').length > 1) invalid('Multiple current legacy plans');
  if (envelope.schemaVersion === 2 && (data.plans.some(plan => plan.model) || data.planVersions.some(version => !('durationWeeks' in version)))) invalid('Day plans require backup version 3');
  if (data.sessions.filter(session => session.status === 'in_progress').length > 1) invalid('Multiple ongoing workouts');
  const plans = new Map(data.plans.map(plan => [plan.id, plan]));
  if (data.plans.some(plan => plan.deletedAt && plan.status !== 'archived')) invalid('Deleted plans must be archived');
  const versions = new Map(data.planVersions.map(version => [version.id, version]));
  const sessions = new Map(data.sessions.map(session => [session.id, session]));
  for (const plan of data.plans) {
    validDate(plan.startDate);
    if (versions.get(plan.currentVersionId)?.planId !== plan.id) invalid('Current plan version not found');
    const current = versions.get(plan.currentVersionId)!;
    if (current.startDate !== plan.startDate || current.scheduleTimeZone !== plan.scheduleTimeZone) invalid('Current plan calendar differs from its version');
  }
  distinct(data.planVersions.map(version => `${version.planId}:${version.versionNumber}`), 'plan version number');
  for (const version of data.planVersions) {
    const plan = plans.get(version.planId);
    if (!plan) invalid('Plan version parent not found');
    if (Boolean(plan.model) !== !('durationWeeks' in version)) invalid('Plan model differs from version');
    validateVersion(version);
  }
  for (const set of data.sets) if (!sessions.has(set.sessionId)) invalid('Set workout not found');
  for (const session of data.sessions) validateSession(session, data.sets.filter(set => set.sessionId === session.id), versions);
  distinct(data.scheduledWorkouts.map(row => `${row.planVersionId}:${row.plannedDayId}`), 'scheduled plan day');
  distinct(data.scheduledWorkouts.flatMap(row => row.completedSessionId ? [row.completedSessionId] : []), 'completed schedule workout');
  for (const row of data.scheduledWorkouts) {
    if (row.hiddenAt && data.sessions.some(session => session.status === 'in_progress' && session.planVersionId === row.planVersionId && session.plannedDayId === row.plannedDayId)) invalid('Hidden schedule has an ongoing workout');
    validDate(row.originalDate);
    validDate(row.scheduledDate);
    const version = versions.get(row.planVersionId);
    const day = version?.days.find(entry => entry.dayId === row.plannedDayId);
    if (!version || !day) invalid('Scheduled plan day not found');
    const weekday = new Date(`${row.originalDate}T00:00:00Z`).getUTCDay() || 7;
    if ('durationWeeks' in version) {
      const legacyDay = version.days.find(entry => entry.dayId === row.plannedDayId)!;
      if (weekday !== legacyDay.dayOfWeek) invalid('Original schedule date does not match plan weekday');
      const original = expandSchedule(version, version.startDate, version.scheduleTimeZone).find(entry => entry.plannedDayId === row.plannedDayId);
      if (original?.originalDate !== row.originalDate) invalid('Original schedule date does not match plan calendar');
    } else if (row.originalDate !== version.startDate) invalid('Day plan original date differs from snapshot');
    if (row.completedSessionId) {
      const session = sessions.get(row.completedSessionId);
      if (!session || session.status !== 'completed' || session.planVersionId !== row.planVersionId || session.plannedDayId !== row.plannedDayId || row.status !== 'pending') invalid('Completed schedule reference is invalid');
    }
  }
  for (const version of data.planVersions) {
    const rows = data.scheduledWorkouts.filter(row => row.planVersionId === version.id);
    if (!('durationWeeks' in version)) {
      if (rows.length !== (plans.get(version.planId)?.currentVersionId === version.id ? 1 : 0)) invalid('Day task association is incomplete');
      continue;
    }
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
  const daySlots: string[] = [];
  for (const row of data.scheduledWorkouts) {
    const version = versions.get(row.planVersionId)!; const plan = plans.get(version.planId)!;
    if (!plan.model) continue;
    const ongoing = data.sessions.some(session => session.status === 'in_progress' && session.planVersionId === row.planVersionId && session.plannedDayId === row.plannedDayId);
    if (!row.completedSessionId && !ongoing && (row.hiddenAt || row.status === 'skipped' || plan.deletedAt || plan.status !== 'active')) continue;
    const projected = projectDay(row.scheduledDate, version.scheduleTimeZone, data.profiles[0].timeZone);
    if (projected) daySlots.push(projected);
  }
  distinct(daySlots, 'occupying day plan date');
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
      validateVersion(entry.planVersionSnapshot);
      memoVersions.set(entry.planVersionSnapshot.id, entry.planVersionSnapshot);
    }
    validateSession(entry.session, entry.sets, memoVersions);
  }
  for (const asset of data.mediaAssets) {
    if (asset.url && !['http:', 'https:'].includes(new URL(asset.url).protocol)) invalid('Media binary or local URL cannot be backed up');
  }
  for (const state of data.guidedStates ?? []) {
    for (const [label, rows] of Object.entries(state)) {
      if (Array.isArray(rows)) distinct(rows.map(row => row.id), `guided ${label} ID`);
    }
    if (state.programs.filter(program => program.status !== 'terminated').length > 1) invalid('Multiple current guided programs');
    const programs = new Map(state.programs.map(program => [program.id, program]));
    const candidates = new Map(state.candidates.map(candidate => [candidate.id, candidate]));
    const tasks = new Map(data.scheduledWorkouts.map(task => [task.id, task]));
    const events = new Map(state.events.map(event => [event.id, event]));
    distinct(state.programs.flatMap(program => program.planIds), 'guided plan ownership');
    distinct(state.programs.flatMap(program => program.taskIds), 'guided task ownership');
    for (const program of state.programs) {
      validDate(program.startDate); validDate(program.endDate);
      if (program.endDate < program.startDate) invalid('Guided program ends before it starts');
      if (!program.planIds.length || !program.taskIds.length) invalid('Guided program membership is empty');
      if (program.candidateId && !candidates.has(program.candidateId)) invalid('Guided program candidate not found');
      if (program.planIds.some(planId => !plans.has(planId))) invalid('Guided program plan not found');
      const memberPlans = program.planIds.map(planId => plans.get(planId)!);
      if (memberPlans.some(plan => plan.status !== (program.status === 'terminated' ? 'archived' : 'active'))) invalid('Guided program child plan status differs');
      if (memberPlans.some(plan => plan.scheduleTimeZone !== program.timeZone)) invalid('Guided program child timezone differs');
      const currentTasks = data.scheduledWorkouts.filter(task => memberPlans.some(plan => plan.currentVersionId === task.planVersionId));
      if (currentTasks.length !== program.taskIds.length || currentTasks.some(task => !program.taskIds.includes(task.id))) invalid('Guided program task membership is incomplete');
      for (const taskId of program.taskIds) {
        const task = tasks.get(taskId);
        if (!task || !program.planIds.includes(versions.get(task.planVersionId)!.planId)) invalid('Guided program task does not belong to its plans');
        const version = versions.get(task.planVersionId)!;
        if (task.originalDate < program.startDate || task.originalDate > program.endDate || version.scheduleTimeZone !== program.timeZone) invalid('Guided program task calendar differs');
      }
      if (program.candidateId) {
        const candidate = candidates.get(program.candidateId)!;
        if (program.startDate !== candidate.startDate || program.endDate !== candidate.endDate || program.timeZone !== candidate.timeZone || program.goal !== candidate.goal) invalid('Guided program differs from adopted candidate');
        if (currentTasks.length !== candidate.days.length) invalid('Guided program candidate membership is incomplete');
        distinct(currentTasks.map(task => task.originalDate), 'guided candidate task date');
        for (const task of currentTasks) {
          const version = versions.get(task.planVersionId)!;
          const candidateDay = candidate.days.find(day => day.date === task.originalDate);
          const versionDay = version.days.find(day => day.dayId === task.plannedDayId)!;
          if (!candidateDay || version.goalSnapshot.goal !== candidate.goal || JSON.stringify(versionDay.exercises) !== JSON.stringify(candidateDay.exercises)) invalid('Guided program task differs from adopted candidate');
        }
      }
    }
    for (const candidate of state.candidates) {
      validDate(candidate.startDate); validDate(candidate.endDate);
      for (const day of candidate.days) {
        validDate(day.date);
        distinct(day.exercises.map(exercise => String(exercise.order)), 'candidate exercise order');
        for (const exercise of day.exercises) {
          const catalog = exercises.find(entry => entry.id === exercise.exerciseId);
          if (!catalog || exercise.targetSets.some(target => target.metricType !== catalog.metricType)) invalid('Candidate target metrics do not match catalog');
        }
      }
    }
    for (const message of state.messages) {
      if (message.programId && !programs.has(message.programId)) invalid('Guided message program not found');
      if (message.candidateId && !candidates.has(message.candidateId)) invalid('Guided message candidate not found');
    }
    for (const event of state.events) {
      if (event.programId && !programs.has(event.programId)) invalid('Guided event program not found');
      if (event.sessionId && !sessions.has(event.sessionId)) invalid('Guided event workout not found');
    }
    state.observations.forEach(observation => validDate(observation.localDate));
    distinct(state.invitations.map(invitation => invitation.eventId), 'guided invitation event');
    for (const invitation of state.invitations) if (!events.has(invitation.eventId)) invalid('Guided invitation event not found');
  }
  return envelope;
}

export function createBackupService(repo: Repository) {
  async function exportBackupWithReceipt(): Promise<{ blob: Blob; dataRevision: number; restoreGeneration: number }> {
    const envelope = await repo.db.transaction('r', repo.db.tables, async () => {
      const metadata = await repo.readMetadata();
      const sessions = await repo.db.sessions.toArray();
      const sets = await repo.db.sets.toArray();
      const versions = await repo.db.planVersions.toArray();
      const previousMemo = await repo.db.trainingMemo.get(1);
      return validateBackupEnvelope({
        format: 'fitness-local', schemaVersion: 6, catalogVersion: 1, exportedAt: new Date().toISOString(),
        data: {
          metadata, profiles: await repo.db.profiles.toArray(), plans: await repo.db.plans.toArray(), planVersions: versions,
          sessions, sets, scheduledWorkouts: await repo.db.scheduledWorkouts.toArray(), bodyWeights: await repo.db.bodyWeights.toArray(),
          aiMemoryNotes: await repo.db.aiMemoryNotes.toArray(), timers: await repo.db.timers.toArray(), mediaAssets: await repo.db.mediaAssets.toArray(),
          guidedStates: await repo.db.guidedStates.toArray(),
          v8: { state: await repo.db.v8State.get('v8'), plans: await repo.db.v8Plans.toArray(), planVersions: await repo.db.v8PlanVersions.toArray(),
            workouts: await repo.db.v8Workouts.toArray(), activities: await repo.db.v8Activities.toArray() },
          trainingMemo: {
            schemaVersion: 1, revision: previousMemo?.revision ?? 0, sourceRevision: metadata.dataRevision, updatedAt: new Date().toISOString(),
            sessions: sessions.map(session => ({ session, sets: sets.filter(set => set.sessionId === session.id).sort((a, b) => a.order - b.order),
              ...(session.planVersionId ? { planVersionSnapshot: versions.find(version => version.id === session.planVersionId) } : {}) })),
          },
        },
      });
    });
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    checkBackupBytes(blob.size);
    return { blob, dataRevision: envelope.data.metadata.dataRevision, restoreGeneration: envelope.data.metadata.restoreGeneration ?? 0 };
  }

  async function exportBackup(): Promise<Blob> {
    return (await exportBackupWithReceipt()).blob;
  }

  async function validateBackup(file: File): Promise<ValidatedBackup> {
    checkBackupBytes(file.size);
    let text: string;
    try { text = await file.text(); }
    catch (reason) { throw new DomainError('BACKUP_INVALID', `Cannot read backup file: ${String(reason)}. Select an accessible local file and try again.`); }
    let value: unknown;
    try { value = JSON.parse(text); }
    catch { throw new DomainError('BACKUP_INVALID', 'Backup is not valid JSON'); }
    return { envelope: validateBackupEnvelope(value), expectedRevision: (await repo.readMetadata()).dataRevision };
  }

  async function importBackup(input: ValidatedBackup, confirmation: ReplaceConfirmation): Promise<ImportReport> {
    if (!confirmation.backupExported || !confirmation.replacementConfirmed || confirmation.expectedRevision !== input.expectedRevision) {
      throw new DomainError('BACKUP_CONFIRMATION_REQUIRED', 'Download and keep the current backup, then confirm complete replacement');
    }
    const envelope = validateBackupEnvelope(input.envelope);
    checkBackupBytes(new Blob([JSON.stringify(envelope)]).size);
    const v8 = envelope.data.v8 ?? await prepareV8Migration(envelope.data, new Date().toISOString());
    let committedGeneration = 0;
    await repo.write(async () => {
      const before = await repo.readMetadata();
      committedGeneration = (before.restoreGeneration ?? 0) + 1;
      if (!Number.isSafeInteger(committedGeneration) || !Number.isSafeInteger(before.dataRevision + 1)) invalid('Local revision counter exhausted');
      // Device reminder preferences and suppression ledger are not portable training facts.
      for (const table of repo.db.tables) if (table.name !== 'coachDevice') await table.clear();
      const data = envelope.data;
      await repo.db.metadata.put({ ...data.metadata, schemaVersion: 8, revision: before.revision, dataRevision: before.dataRevision, restoreGeneration: committedGeneration, importedAt: new Date().toISOString() });
      await repo.db.profiles.bulkAdd(data.profiles);
      await repo.db.plans.bulkAdd(data.plans);
      await repo.db.planVersions.bulkAdd(data.planVersions);
      await repo.db.sessions.bulkAdd(data.sessions);
      await repo.db.sets.bulkAdd(data.sets);
      // Retained raw durations are intentionally wider than the editable scheduling model.
      await Dexie.currentTransaction!.table('scheduledWorkouts').bulkAdd(data.scheduledWorkouts);
      await repo.db.bodyWeights.bulkAdd(data.bodyWeights);
      await repo.db.aiMemoryNotes.bulkAdd(data.aiMemoryNotes);
      await repo.db.timers.bulkAdd(data.timers);
      await repo.db.mediaAssets.bulkAdd(data.mediaAssets);
      if (data.guidedStates) await repo.db.guidedStates.bulkAdd(data.guidedStates);
      await repo.db.trainingMemo.put(data.trainingMemo);
      await writeV8Library(Dexie.currentTransaction!, v8);
      await synchronizeTrainingMemo(repo);
    }, input.expectedRevision);
    // Synchronous observers remove stale forms before this repository adopts the new generation.
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(restoreEventName, { detail: { databaseName: repo.db.name } }));
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
  return { exportBackup, exportBackupWithReceipt, validateBackup, importBackup };
}

export const backupService = createBackupService(repository);
export const { exportBackup, validateBackup, importBackup } = backupService;
