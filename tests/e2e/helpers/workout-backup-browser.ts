import Dexie from 'dexie';
import { createDatabase } from '../../../src/persistence/db';
import { createRepository } from '../../../src/persistence/repository';
import { createProfileService } from '../../../src/application/profile';
import { createWorkoutService } from '../../../src/application/workouts';
import { createTimerService } from '../../../src/application/timers';
import { createBackupService } from '../../../src/application/backup';
import { createPlanService } from '../../../src/application/plans';
import { exercises } from '../../../src/catalog/exercises';

export async function verifyWorkoutBackup(kind: 'timers' | 'order' | 'skip') {
  const name = `fitness-workout-backup-${crypto.randomUUID()}`;
  const db = createDatabase(name);
  try {
    const repo = createRepository(db);
    await createProfileService(repo).initialize('en');
    const workouts = createWorkoutService(repo);
    const plans = createPlanService(repo);
    let scheduleId: string | undefined;
    if (kind === 'skip') {
      await plans.savePlan({ name: 'Backup-safe plan', source: 'manual', startDate: '2026-10-03', scheduleTimeZone: 'UTC', goalSnapshot: { goal: 'Strength' }, durationWeeks: 1, daysPerWeek: 1, days: [{ dayId: crypto.randomUUID(), weekIndex: 1, dayOfWeek: 6, exercises: [{ exerciseId: 'd16325d9-fc00-4c41-88a1-000000000001', order: 0, targetSets: [{ metricType: 'reps_load', reps: 8, loadGrams: 0 }] }] }] });
      scheduleId = (await workouts.listAvailableSchedule())[0].id;
    }
    let session = await workouts.startWorkout({ sessionId: crypto.randomUUID(), localDate: '2026-10-03', timeZone: 'UTC', ...(scheduleId ? { scheduledWorkoutId: scheduleId } : { exerciseIds: [exercises[0].id, exercises[0].id] }) });
    let invariant = false;
    if (kind === 'timers') {
      const now = new Date().toISOString();
      for (const exercise of session.exerciseSnapshots) {
        await createTimerService(repo).saveTimer({ id: crypto.randomUUID(), sessionId: session.id, exerciseInstanceId: exercise.exerciseInstanceId, kind: 'exercise', status: 'stopped', accumulatedMs: 1000, revision: 0, createdAt: now, updatedAt: now });
      }
      session = await workouts.adjustWorkout(session.id, { type: 'remove_exercise', exerciseInstanceId: session.exerciseSnapshots[0].exerciseInstanceId, confirmDeleteRecords: true }, session.revision);
      invariant = (await db.timers.toArray()).length === 1 && (await db.timers.toArray())[0].exerciseInstanceId === session.exerciseSnapshots[0].exerciseInstanceId;
    } else if (kind === 'order') {
      session = await workouts.adjustWorkout(session.id, { type: 'remove_exercise', exerciseInstanceId: session.exerciseSnapshots[0].exerciseInstanceId, confirmDeleteRecords: true }, session.revision);
      session = await workouts.adjustWorkout(session.id, { type: 'add_exercise', exerciseId: exercises[0].id, exerciseInstanceId: crypto.randomUUID() }, session.revision);
      invariant = new Set(session.exerciseSnapshots.map(exercise => exercise.order)).size === 2;
    } else {
      const row = (await db.scheduledWorkouts.get(scheduleId!))!;
      invariant = await plans.skipWorkout(row.id, row.revision).then(() => false, error => error.code === 'WORKOUT_IN_PROGRESS');
    }
    session = await workouts.recordSet(session.id, { id: crypto.randomUUID(), exerciseInstanceId: session.exerciseSnapshots[0].exerciseInstanceId, order: 0, metricType: 'reps_load', reps: 8, loadGrams: 0, completed: true }, session.revision);
    await workouts.completeWorkout(session.id, session.revision);
    const backup = createBackupService(repo);
    const roundTrip = await backup.exportBackup().then(async blob => {
      const checked = await backup.validateBackup(new File([await blob.text()], 'backup.json'));
      await backup.importBackup(checked, { backupExported: true, replacementConfirmed: true, expectedRevision: checked.expectedRevision });
      return (await db.sessions.get(session.id))?.status === 'completed';
    }).catch(() => false);
    return await db.transaction('r', db.tables, async () => ({ invariant, roundTrip }));
  } finally {
    db.close();
    await Dexie.delete(name);
  }
}

