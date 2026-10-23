import type { BackupEnvelope } from '../../domain/models';
import { exercises } from '../../catalog/exercises';
import { distinct, invalid, validDate } from './checks';

type BackupData = BackupEnvelope['data'];

export function validateV8Library(
  envelope: BackupEnvelope,
  data: BackupData,
  library: NonNullable<BackupData['v8']>,
): void {
  if (
    envelope.schemaVersion < 9 &&
    (library.planReferences !== undefined ||
      library.plans.some(
        p =>
          p.deletedAt !== undefined || p.deletedWasCurrent !== undefined || p.deletedNextWorkoutOverride !== undefined,
      ) ||
      library.state.planDismissedAt !== undefined ||
      library.state.reviewWeeklyTarget !== undefined)
  )
    invalid('Plan lifecycle requires backup version 9');
  if (envelope.schemaVersion >= 9 && !library.planReferences) invalid('Plan reference collection required');
  const v8Plans = new Map(library.plans.map(plan => [plan.id, plan]));
  const v8Versions = new Map(library.planVersions.map(version => [version.id, version]));
  for (const [label, rows] of Object.entries(library))
    if (Array.isArray(rows))
      distinct(
        rows.map(row => row.id),
        `V8 ${label}`,
      );
  if (
    library.state.currentPlanId &&
    (!v8Plans.has(library.state.currentPlanId) || v8Plans.get(library.state.currentPlanId)?.deletedAt)
  )
    invalid('V8 current plan missing');
  const override = library.state.nextWorkoutOverride;
  if (override) {
    const current = library.state.currentPlanId ? v8Plans.get(library.state.currentPlanId) : undefined;
    if (
      current?.currentVersionId !== override.planVersionId ||
      !v8Versions.get(override.planVersionId)?.templates.some(t => t.id === override.templateId)
    )
      invalid('V8 next workout override target missing');
  }
  if (
    library.plans.some(
      plan =>
        v8Versions.get(plan.currentVersionId)?.planId !== plan.id ||
        plan.readOnly !== (plan.id !== library.state.currentPlanId),
    )
  )
    invalid('V8 current version or read-only state invalid');
  for (const version of library.planVersions) {
    if (!v8Plans.has(version.planId)) invalid('V8 version parent missing');
    distinct(
      version.templates.map(template => template.id),
      'V8 template',
    );
    if (
      version.origin === 'migrated' &&
      !data.planVersions.some(
        original => original.id === version.basedOnVersionId && original.planId === version.planId,
      )
    )
      invalid('V8 migration source missing');
  }
  distinct(
    library.planVersions.map(version => `${version.planId}:${version.versionNumber}`),
    'V8 version number',
  );
  const references = new Map((library.planReferences ?? []).map(r => [r.id, r]));
  for (const ref of references.values()) {
    if (v8Versions.has(ref.id) || v8Plans.has(ref.planId) || !library.workouts.some(w => w.planVersionId === ref.id))
      invalid('Invalid archived plan reference');
    distinct(ref.templateIds, 'archived template IDs');
    distinct(
      (ref.legacyTemplates ?? []).map(t => t.id),
      'archived legacy templates',
    );
    if (
      ref.templateIds.some(id => !library.workouts.some(w => w.planVersionId === ref.id && w.templateId === id)) ||
      (ref.legacyTemplates ?? []).some(
        t =>
          !ref.templateIds.includes(t.id) ||
          !library.workouts.some(w => w.planVersionId === ref.id && w.templateId === t.id && !w.templateSnapshot),
      )
    )
      invalid('Unreferenced archived template');
  }
  for (const plan of library.plans) {
    const saved = plan.deletedNextWorkoutOverride;
    if (
      saved &&
      (!plan.deletedAt ||
        !plan.deletedWasCurrent ||
        saved.planVersionId !== plan.currentVersionId ||
        v8Versions.get(saved.planVersionId)?.planId !== plan.id ||
        !v8Versions.get(saved.planVersionId)?.templates.some(t => t.id === saved.templateId))
    )
      invalid('Invalid deleted plan workout override');
  }
  if (library.plans.some(p => p.deletedWasCurrent !== undefined && !p.deletedAt))
    invalid('Invalid deleted plan marker');
  for (const workout of library.workouts) {
    const version = workout.planVersionId ? v8Versions.get(workout.planVersionId) : undefined;
    const reference = workout.planVersionId ? references.get(workout.planVersionId) : undefined;
    if (
      (workout.planVersionId && !version && !reference) ||
      (workout.templateId &&
        !(
          version?.templates.some(template => template.id === workout.templateId) ||
          reference?.templateIds.includes(workout.templateId)
        ))
    )
      invalid('V8 workout plan or template missing');
    if (workout.status === 'in_progress' && version && v8Plans.get(version.planId)?.deletedAt)
      invalid('Active workout belongs to deleted plan');
    if (
      reference &&
      (workout.status === 'in_progress' ||
        (!workout.templateSnapshot && !reference.legacyTemplates?.some(t => t.id === workout.templateId)))
    )
      invalid('Archived workout provenance incomplete');
    if (
      workout.templateSnapshot &&
      ((workout.planVersionId !== undefined && !version && !reference) ||
        workout.templateSnapshot.items.reduce((sum, item) => sum + item.sets, 0) !== workout.plannedSetCount ||
        workout.templateSnapshot.items.some(
          (item, index) =>
            workout.plannedExercises?.[index]?.exerciseId !== item.exerciseId ||
            workout.plannedExercises?.[index]?.plannedSetCount !== item.sets,
        ))
    )
      invalid('V8 workout snapshot mismatch');
    validDate(workout.localDate);
  }
  library.activities.forEach(activity => validDate(activity.localDate));
  if (library.state.legacyPlanIds.some(id => !data.plans.some(plan => plan.id === id)))
    invalid('V8 retained legacy plan missing');
}

export function validateGuidedStates(
  data: BackupData,
  plans: Map<string, BackupData['plans'][number]>,
  versions: Map<string, BackupData['planVersions'][number]>,
  sessions: Map<string, BackupData['sessions'][number]>,
): void {
  for (const state of data.guidedStates ?? []) {
    for (const [label, rows] of Object.entries(state)) {
      if (Array.isArray(rows))
        distinct(
          rows.map(row => row.id),
          `guided ${label} ID`,
        );
    }
    if (state.programs.filter(program => program.status !== 'terminated').length > 1)
      invalid('Multiple current guided programs');
    const programs = new Map(state.programs.map(program => [program.id, program]));
    const candidates = new Map(state.candidates.map(candidate => [candidate.id, candidate]));
    const tasks = new Map(data.scheduledWorkouts.map(task => [task.id, task]));
    const events = new Map(state.events.map(event => [event.id, event]));
    distinct(
      state.programs.flatMap(program => program.planIds),
      'guided plan ownership',
    );
    distinct(
      state.programs.flatMap(program => program.taskIds),
      'guided task ownership',
    );
    for (const program of state.programs) {
      validDate(program.startDate);
      validDate(program.endDate);
      if (program.endDate < program.startDate) invalid('Guided program ends before it starts');
      if (!program.planIds.length || !program.taskIds.length) invalid('Guided program membership is empty');
      if (program.candidateId && !candidates.has(program.candidateId)) invalid('Guided program candidate not found');
      if (program.planIds.some(planId => !plans.has(planId))) invalid('Guided program plan not found');
      const memberPlans = program.planIds.map(planId => plans.get(planId)!);
      if (memberPlans.some(plan => plan.status !== (program.status === 'terminated' ? 'archived' : 'active')))
        invalid('Guided program child plan status differs');
      if (memberPlans.some(plan => plan.scheduleTimeZone !== program.timeZone))
        invalid('Guided program child timezone differs');
      const currentTasks = data.scheduledWorkouts.filter(task =>
        memberPlans.some(plan => plan.currentVersionId === task.planVersionId),
      );
      if (
        currentTasks.length !== program.taskIds.length ||
        currentTasks.some(task => !program.taskIds.includes(task.id))
      )
        invalid('Guided program task membership is incomplete');
      for (const taskId of program.taskIds) {
        const task = tasks.get(taskId);
        if (!task || !program.planIds.includes(versions.get(task.planVersionId)!.planId))
          invalid('Guided program task does not belong to its plans');
        const version = versions.get(task.planVersionId)!;
        if (
          task.originalDate < program.startDate ||
          task.originalDate > program.endDate ||
          version.scheduleTimeZone !== program.timeZone
        )
          invalid('Guided program task calendar differs');
      }
      if (program.candidateId) {
        const candidate = candidates.get(program.candidateId)!;
        if (
          program.startDate !== candidate.startDate ||
          program.endDate !== candidate.endDate ||
          program.timeZone !== candidate.timeZone ||
          program.goal !== candidate.goal
        )
          invalid('Guided program differs from adopted candidate');
        if (currentTasks.length !== candidate.days.length) invalid('Guided program candidate membership is incomplete');
        distinct(
          currentTasks.map(task => task.originalDate),
          'guided candidate task date',
        );
        for (const task of currentTasks) {
          const version = versions.get(task.planVersionId)!;
          const candidateDay = candidate.days.find(day => day.date === task.originalDate);
          const versionDay = version.days.find(day => day.dayId === task.plannedDayId)!;
          if (
            !candidateDay ||
            version.goalSnapshot.goal !== candidate.goal ||
            JSON.stringify(versionDay.exercises) !== JSON.stringify(candidateDay.exercises)
          )
            invalid('Guided program task differs from adopted candidate');
        }
      }
    }
    for (const candidate of state.candidates) {
      validDate(candidate.startDate);
      validDate(candidate.endDate);
      for (const day of candidate.days) {
        validDate(day.date);
        distinct(
          day.exercises.map(exercise => String(exercise.order)),
          'candidate exercise order',
        );
        for (const exercise of day.exercises) {
          const catalog = exercises.find(entry => entry.id === exercise.exerciseId);
          if (!catalog || exercise.targetSets.some(target => target.metricType !== catalog.metricType))
            invalid('Candidate target metrics do not match catalog');
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
    distinct(
      state.invitations.map(invitation => invitation.eventId),
      'guided invitation event',
    );
    for (const invitation of state.invitations)
      if (!events.has(invitation.eventId)) invalid('Guided invitation event not found');
  }
}
