import Dexie from 'dexie';
import { createDatabase } from '../../../src/persistence/db';
import { createRepository } from '../../../src/persistence/repository';
import { createProfileService } from '../../../src/application/profile';
import { createPlanService } from '../../../src/application/plans';
import { createWorkoutService } from '../../../src/application/workouts';
import { createBackupService } from '../../../src/application/backup';
import type { PlanInput } from '../../../src/domain/models';

export async function verifyPlanDeletion() {
  const name = `fitness-plan-delete-${crypto.randomUUID()}`;
  const db = createDatabase(name);
  try {
    const repo = createRepository(db);
    await createProfileService(repo).initialize('en');
    const plans = createPlanService(repo);
    const workouts = createWorkoutService(repo);
    const input = (): PlanInput => ({ name: 'Deletion case', source: 'manual', status: 'active', startDate: '2026-10-03', scheduleTimeZone: 'UTC', goalSnapshot: { goal: '' }, durationWeeks: 1, daysPerWeek: 1, days: [{ dayId: crypto.randomUUID(), weekIndex: 1, dayOfWeek: 6, exercises: [{ exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0, targetSets: [{ metricType: 'reps', reps: 8 }] }] }] });
    const unused = await plans.savePlan(input());
    const edited = await plans.savePlan({ ...input(), id: unused.id }, unused.revision);
    const conflict = await plans.deletePlan(unused.id, unused.revision).then(() => false, error => error.code === 'CONFLICT');
    const snapshot = async () => JSON.stringify(await Promise.all(db.tables.filter((table:{name:string})=>table.name!=='coachDevice').map(table => table.toArray())));
    const before = await snapshot();
    const fail = () => { throw new Error('Simulated schedule deletion failure'); };
    db.scheduledWorkouts.hook('deleting', fail);
    let failed = false;
    try { await plans.deletePlan(edited.id, edited.revision); } catch { failed = true; }
    db.scheduledWorkouts.hook('deleting').unsubscribe(fail);
    const rollback = failed && before === await snapshot();
    await plans.deletePlan(edited.id, edited.revision);
    const removed = !(await db.plans.get(edited.id)) && await db.planVersions.count() === 0 && await db.scheduledWorkouts.count() === 0;

    const historical = await plans.savePlan(input());
    const updated = await plans.savePlan({ ...input(), id: historical.id }, historical.revision);
    const oldRow = (await db.scheduledWorkouts.where('planVersionId').equals(historical.currentVersionId).toArray())[0];
    const currentRow = (await db.scheduledWorkouts.where('planVersionId').equals(updated.currentVersionId).toArray())[0];
    let session = await workouts.startWorkout({ sessionId: crypto.randomUUID(), localDate: '2026-10-03', timeZone: 'UTC', scheduledWorkoutId: oldRow.id });
    const ongoingBefore = await snapshot();
    const blocked = await plans.deletePlan(updated.id, updated.revision).then(() => false, error => error.code === 'WORKOUT_IN_PROGRESS');
    const ongoingUnchanged = ongoingBefore === await snapshot();
    session = await workouts.recordSet(session.id, { id: crypto.randomUUID(), exerciseInstanceId: session.exerciseSnapshots[0].exerciseInstanceId, order: 0, metricType: 'reps', reps: 8, completed: true }, session.revision);
    await workouts.completeWorkout(session.id, session.revision);
    const historyBefore = JSON.stringify([await db.sessions.toArray(), await db.sets.toArray(), await db.trainingMemo.toArray(), await db.planVersions.toArray(), await db.scheduledWorkouts.toArray()]);
    await plans.deletePlan(updated.id, updated.revision);
    const retained = historyBefore === JSON.stringify([await db.sessions.toArray(), await db.sets.toArray(), await db.trainingMemo.toArray(), await db.planVersions.toArray(), await db.scheduledWorkouts.toArray()]);
    const hidden = (await db.plans.get(updated.id))!;
    const archived = hidden.status === 'archived' && !!hidden.deletedAt;
    const cannotEdit = await plans.savePlan({ ...input(), id: hidden.id }, hidden.revision).then(() => false, error => error.code === 'INVALID');
    const cannotStart = await workouts.startWorkout({ sessionId: crypto.randomUUID(), localDate: '2026-10-03', timeZone: 'UTC', scheduledWorkoutId: currentRow.id }).then(() => false, error => error.code === 'INVALID');
    const cannotReschedule = await plans.rescheduleWorkout(currentRow.id, '2026-10-04', currentRow.revision).then(() => false, error => error.code === 'INVALID');
    const noActiveSchedule = (await workouts.listAvailableSchedule()).length === 0;
    const backup = createBackupService(repo);
    const blob = await backup.exportBackup();
    const checked = await backup.validateBackup(new File([await blob.text()], 'deleted-plan-backup.json'));
    await backup.importBackup(checked, { backupExported: true, replacementConfirmed: true, expectedRevision: checked.expectedRevision });
    const roundTrip = (await db.plans.get(hidden.id))?.deletedAt === hidden.deletedAt && (await db.sessions.get(session.id))?.status === 'completed' && await db.planVersions.count() === 2 && (await db.trainingMemo.get(1))?.sessions[0].sets[0].reps === 8;
    return await db.transaction('r', db.tables, async () => ({ conflict, rollback, removed, blocked, ongoingUnchanged, retained, archived, cannotEdit, cannotStart, cannotReschedule, noActiveSchedule, roundTrip }));
  } finally {
    db.close();
    await Dexie.delete(name);
  }
}
