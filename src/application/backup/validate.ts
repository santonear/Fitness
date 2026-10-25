import { BACKUP_VERSION, SUPPORTED_BACKUP_VERSIONS } from '../../domain/storage-version';
import type { BackupEnvelope, ExerciseSnapshot, PlanVersion, SetRecord, WorkoutSession } from '../../domain/models';
import { backupEnvelopeSchema } from '../../domain/schemas';
import { DomainError } from '../../domain/errors';
import { knownExerciseIds } from '../../catalog/registry';
import { exercises } from '../../catalog/exercises';
import { expandSchedule } from '../../domain/calendar';
import { projectDay } from '../../domain/day-date-projection';
import { DAY_MS } from '../../domain/local-date';
import { distinct, invalid, validDate } from './checks';
import { validateGuidedStates, validateV8Library } from './validate-sections';

function validateSnapshot(snapshot: ExerciseSnapshot): void {
  const catalog = exercises.find(exercise => exercise.id === snapshot.exerciseId);
  if (
    !catalog ||
    snapshot.id !== snapshot.exerciseId ||
    snapshot.catalogVersion !== catalog.catalogVersion ||
    snapshot.category !== catalog.category ||
    snapshot.equipment !== catalog.equipment ||
    snapshot.metricType !== catalog.metricType ||
    JSON.stringify(snapshot.allowedMetrics) !== JSON.stringify(catalog.allowedMetrics) ||
    snapshot.targetSets.some(target => target.metricType !== catalog.metricType)
  )
    invalid('Exercise snapshot does not match catalog metrics');
}
function validateVersion(version: PlanVersion): void {
  validDate(version.startDate);
  try {
    if ('durationWeeks' in version) expandSchedule(version, version.startDate, version.scheduleTimeZone);
  } catch {
    invalid('Invalid plan calendar');
  }
  for (const day of version.days) {
    distinct(
      day.exercises.map(exercise => String(exercise.order)),
      'planned exercise order',
    );
    for (const exercise of day.exercises) {
      const catalog = exercises.find(entry => entry.id === exercise.exerciseId);
      if (!catalog || exercise.targetSets.some(target => target.metricType !== catalog.metricType))
        invalid('Plan target metrics do not match catalog');
    }
  }
}
function validateSession(session: WorkoutSession, sets: SetRecord[], versions: Map<string, PlanVersion>): void {
  validDate(session.localDate);
  if ((session.status === 'completed') !== (session.completedAt !== undefined))
    invalid('Workout completion timestamp does not match status');
  // Historical clock anomalies remain exportable; V8 duration statistics exclude them.
  if ((session.planVersionId === undefined) !== (session.plannedDayId === undefined))
    invalid('Workout plan references must appear together');
  if (
    session.planVersionId &&
    !versions.get(session.planVersionId)?.days.some(day => day.dayId === session.plannedDayId)
  )
    invalid('Workout plan day not found');
  const version = session.planVersionId ? versions.get(session.planVersionId) : undefined;
  if (version && !('durationWeeks' in version)) {
    const day = version.days[0];
    if (
      session.originalExerciseSnapshots.length !== day.exercises.length ||
      day.exercises.some(item => {
        const original = session.originalExerciseSnapshots.find(snapshot => snapshot.order === item.order);
        return (
          !original ||
          original.exerciseId !== item.exerciseId ||
          JSON.stringify(original.targetSets) !== JSON.stringify(item.targetSets) ||
          original.notes !== item.notes
        );
      })
    )
      invalid('Day training original snapshot differs from its fixed version');
  }
  for (const snapshots of [session.originalExerciseSnapshots, session.exerciseSnapshots]) {
    distinct(
      snapshots.map(exercise => exercise.exerciseInstanceId),
      'exercise instance',
    );
    distinct(
      snapshots.map(exercise => String(exercise.order)),
      'exercise order',
    );
    snapshots.forEach(validateSnapshot);
  }
  distinct(
    sets.map(set => set.id),
    'set ID',
  );
  distinct(
    sets.map(set => `${set.exerciseInstanceId}:${set.order}`),
    'set order',
  );
  for (const set of sets) {
    const exercise = session.exerciseSnapshots.find(snapshot => snapshot.exerciseInstanceId === set.exerciseInstanceId);
    if (set.sessionId !== session.id || !exercise || exercise.metricType !== set.metricType)
      invalid('Set workout or exercise reference is invalid');
  }
  if (session.status === 'completed' && !sets.some(set => set.completed))
    invalid('Completed workout has no completed set');
}

export function validateBackupEnvelope(value: unknown): BackupEnvelope {
  if (
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    !SUPPORTED_BACKUP_VERSIONS.includes(value.schemaVersion as number)
  ) {
    throw new DomainError(
      'BACKUP_VERSION_UNSUPPORTED',
      `Unsupported JSON backup version; versions 2 through ${BACKUP_VERSION} are supported`,
    );
  }
  const parsed = backupEnvelopeSchema.safeParse(value);
  if (!parsed.success) throw new DomainError('BACKUP_INVALID', `Invalid backup: ${parsed.error.message}`);
  const envelope = parsed.data;
  const data = envelope.data;
  if (envelope.schemaVersion < 11 && data.assistantConversations !== undefined)
    invalid('Assistant conversations require version 11');
  if (envelope.schemaVersion >= 10 && !data.exerciseFavorites) invalid('Exercise favorites required');
  if (envelope.schemaVersion < 10 && data.exerciseFavorites !== undefined)
    invalid('Exercise favorites require version 10');
  if (data.exerciseFavorites) {
    distinct(
      data.exerciseFavorites.map(row => row.id),
      'favorite exercise',
    );
    if (data.exerciseFavorites.some(row => !knownExerciseIds.has(row.id))) invalid('Unknown favorite exercise');
  }

  if (envelope.schemaVersion >= 4 && !data.guidedStates)
    invalid('Guided state collection is required in backup versions 4 and 5');
  if (envelope.schemaVersion < 4 && data.guidedStates?.length) invalid('Guided state requires backup version 4');
  if (
    envelope.catalogVersion !== 1 ||
    data.metadata.catalogVersion !== 1 ||
    data.metadata.schemaVersion !==
      (envelope.schemaVersion >= 6 ? envelope.schemaVersion + 2 : envelope.schemaVersion + 1) ||
    data.trainingMemo.schemaVersion !== 1
  ) {
    throw new DomainError('BACKUP_VERSION_UNSUPPORTED', 'Unsupported catalog, metadata or memo version');
  }
  if ((envelope.schemaVersion >= 6 && !data.v8) || (envelope.schemaVersion < 6 && data.v8))
    invalid('V8 collections require backup version 6 or newer');
  if (envelope.schemaVersion >= 7) {
    if (!data.nutritionRecords || !data.activityImportReceipts) invalid('Lifestyle collections required');
    distinct(
      data.nutritionRecords!.map(row => row.id),
      'nutrition ID',
    );
    distinct(
      data.activityImportReceipts!.map(row => row.id),
      'import receipt ID',
    );
    distinct(
      data.activityImportReceipts!.map(row => row.activityId),
      'imported activity ID',
    );
    const activityIds = new Set(data.v8?.activities.map(row => row.id));
    if (data.activityImportReceipts!.some(row => !activityIds.has(row.activityId)))
      invalid('Imported activity missing');
  } else if (data.nutritionRecords || data.activityImportReceipts) invalid('Lifestyle collections require version 7');
  const planUpgradeRows = [data.fitnessTests, data.journeys, data.futureLetters];
  if (envelope.schemaVersion >= 19) {
    // Exported files always carry the three tables; an absent table restores as empty.
    (data.fitnessTests ?? []).forEach(row => validDate(row.localDate));
    distinct(
      (data.journeys ?? []).map(row => String(row.version)),
      'journey version',
    );
    const campIds = new Set((data.journeys ?? []).flatMap(row => row.camps.map(camp => camp.id)));
    if ((data.futureLetters ?? []).some(row => row.openAtCampId !== undefined && !campIds.has(row.openAtCampId)))
      invalid('Future letter camp missing');
  } else if (
    planUpgradeRows.some(rows => rows !== undefined) ||
    data.v8?.state.homePanelStyle !== undefined ||
    data.v8?.planVersions.some(version => version.weeklyBudget !== undefined || version.starterProgram !== undefined)
  ) {
    invalid('Plan upgrade data requires backup version 19');
  }
  if (data.v8) validateV8Library(envelope, data, data.v8);
  for (const [label, rows] of Object.entries(data)) {
    if (Array.isArray(rows))
      distinct(
        rows.map(row => row.id),
        `${label} ID`,
      );
  }
  if (data.profiles.length !== 1 || data.profiles[0].id !== data.metadata.localProfileId)
    invalid('Exactly one matching local profile is required');
  if (data.plans.filter(plan => !plan.model && plan.status === 'active').length > 1)
    invalid('Multiple current legacy plans');
  if (
    envelope.schemaVersion === 2 &&
    (data.plans.some(plan => plan.model) || data.planVersions.some(version => !('durationWeeks' in version)))
  )
    invalid('Day plans require backup version 3');
  if (data.sessions.filter(session => session.status === 'in_progress').length > 1)
    invalid('Multiple ongoing workouts');
  const plans = new Map(data.plans.map(plan => [plan.id, plan]));
  if (data.plans.some(plan => plan.deletedAt && plan.status !== 'archived')) invalid('Deleted plans must be archived');
  const versions = new Map(data.planVersions.map(version => [version.id, version]));
  const sessions = new Map(data.sessions.map(session => [session.id, session]));
  for (const plan of data.plans) {
    validDate(plan.startDate);
    if (versions.get(plan.currentVersionId)?.planId !== plan.id) invalid('Current plan version not found');
    const current = versions.get(plan.currentVersionId)!;
    if (current.startDate !== plan.startDate || current.scheduleTimeZone !== plan.scheduleTimeZone)
      invalid('Current plan calendar differs from its version');
  }
  distinct(
    data.planVersions.map(version => `${version.planId}:${version.versionNumber}`),
    'plan version number',
  );
  for (const version of data.planVersions) {
    const plan = plans.get(version.planId);
    if (!plan) invalid('Plan version parent not found');
    if (Boolean(plan.model) !== !('durationWeeks' in version)) invalid('Plan model differs from version');
    validateVersion(version);
  }
  for (const set of data.sets) if (!sessions.has(set.sessionId)) invalid('Set workout not found');
  for (const session of data.sessions)
    validateSession(
      session,
      data.sets.filter(set => set.sessionId === session.id),
      versions,
    );
  distinct(
    data.scheduledWorkouts.map(row => `${row.planVersionId}:${row.plannedDayId}`),
    'scheduled plan day',
  );
  distinct(
    data.scheduledWorkouts.flatMap(row => (row.completedSessionId ? [row.completedSessionId] : [])),
    'completed schedule workout',
  );
  for (const row of data.scheduledWorkouts) {
    if (
      row.hiddenAt &&
      data.sessions.some(
        session =>
          session.status === 'in_progress' &&
          session.planVersionId === row.planVersionId &&
          session.plannedDayId === row.plannedDayId,
      )
    )
      invalid('Hidden schedule has an ongoing workout');
    validDate(row.originalDate);
    validDate(row.scheduledDate);
    const version = versions.get(row.planVersionId);
    const day = version?.days.find(entry => entry.dayId === row.plannedDayId);
    if (!version || !day) invalid('Scheduled plan day not found');
    const weekday = new Date(`${row.originalDate}T00:00:00Z`).getUTCDay() || 7;
    if ('durationWeeks' in version) {
      const legacyDay = version.days.find(entry => entry.dayId === row.plannedDayId)!;
      if (weekday !== legacyDay.dayOfWeek) invalid('Original schedule date does not match plan weekday');
      const original = expandSchedule(version, version.startDate, version.scheduleTimeZone).find(
        entry => entry.plannedDayId === row.plannedDayId,
      );
      if (original?.originalDate !== row.originalDate) invalid('Original schedule date does not match plan calendar');
    } else if (row.originalDate !== version.startDate) invalid('Day plan original date differs from snapshot');
    if (row.completedSessionId) {
      const session = sessions.get(row.completedSessionId);
      if (
        !session ||
        session.status !== 'completed' ||
        session.planVersionId !== row.planVersionId ||
        session.plannedDayId !== row.plannedDayId ||
        row.status !== 'pending'
      )
        invalid('Completed schedule reference is invalid');
    }
  }
  for (const version of data.planVersions) {
    const rows = data.scheduledWorkouts.filter(row => row.planVersionId === version.id);
    if (!('durationWeeks' in version)) {
      if (rows.length !== (plans.get(version.planId)?.currentVersionId === version.id ? 1 : 0))
        invalid('Day task association is incomplete');
      continue;
    }
    if (rows.length !== version.days.length) invalid('Plan schedule is incomplete');
    // Historical versions keep their calendar when the plan's current start date changes.
    const dates = rows.map(row => {
      const day = version.days.find(entry => entry.dayId === row.plannedDayId)!;
      return Date.parse(`${row.originalDate}T00:00:00Z`) - (day.weekIndex - 1) * 7 * DAY_MS;
    });
    if (Math.max(...dates) - Math.min(...dates) >= 7 * DAY_MS) invalid('Schedule dates do not match cycle weeks');
  }
  for (const session of data.sessions) {
    if (
      session.status === 'completed' &&
      session.planVersionId &&
      !data.scheduledWorkouts.some(row => row.completedSessionId === session.id)
    )
      invalid('Completed planned workout has no schedule link');
  }
  const daySlots: string[] = [];
  for (const row of data.scheduledWorkouts) {
    const version = versions.get(row.planVersionId)!;
    const plan = plans.get(version.planId)!;
    if (!plan.model) continue;
    const ongoing = data.sessions.some(
      session =>
        session.status === 'in_progress' &&
        session.planVersionId === row.planVersionId &&
        session.plannedDayId === row.plannedDayId,
    );
    if (
      !row.completedSessionId &&
      !ongoing &&
      (row.hiddenAt || row.status === 'skipped' || plan.deletedAt || plan.status !== 'active')
    )
      continue;
    const projected = projectDay(row.scheduledDate, version.scheduleTimeZone, data.profiles[0].timeZone);
    if (projected) daySlots.push(projected);
  }
  distinct(daySlots, 'occupying day plan date');
  if (envelope.schemaVersion < 10)
    distinct(
      data.bodyWeights.map(row => row.localDate),
      'weight observation date',
    );
  data.bodyWeights.forEach(row => validDate(row.localDate));
  distinct(
    data.timers.map(timer => `${timer.sessionId}:${timer.exerciseInstanceId}:${timer.kind}`),
    'timer association',
  );
  for (const timer of data.timers) {
    const session = sessions.get(timer.sessionId);
    if (
      !session ||
      !timer.exerciseInstanceId ||
      !session.exerciseSnapshots.some(exercise => exercise.exerciseInstanceId === timer.exerciseInstanceId)
    )
      invalid('Timer workout or exercise not found');
    if (
      (timer.status === 'running') !== (timer.startedAtMs !== undefined) ||
      (timer.kind === 'rest' && !timer.targetMs)
    )
      invalid('Timer state does not match status or kind');
  }
  distinct(
    data.trainingMemo.sessions.map(entry => entry.session.id),
    'memo workout',
  );
  distinct(
    data.trainingMemo.sessions.flatMap(entry => entry.sets.map(set => set.id)),
    'memo set ID',
  );
  if (data.trainingMemo.sessions.filter(entry => entry.session.status === 'in_progress').length > 1)
    invalid('Multiple ongoing memo workouts');
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
    if (asset.url && !['http:', 'https:'].includes(new URL(asset.url).protocol))
      invalid('Media binary or local URL cannot be backed up');
  }
  validateGuidedStates(data, plans, versions, sessions);
  return envelope;
}
