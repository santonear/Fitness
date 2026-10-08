import { createDatabase } from '../../src/persistence/db';
import { createRepository } from '../../src/persistence/repository';
import { createProfileService } from '../../src/application/profile';
import { createDayPlanService, type DayPlanInput } from '../../src/application/day-plans';
import { createBackupService, MAX_BACKUP_BYTES } from '../../src/application/backup';
import { EXERCISE_IDS } from '../../src/catalog/exercise-ids';

export async function verifyDayPlanSafety(scenario: 'capacity' | 'duration') {
  const db = createDatabase('v31-day-plan-safety-' + crypto.randomUUID());
  const repo = createRepository(db);
  try {
    const profile = await createProfileService(repo).initialize('en');
    const service = createDayPlanService(repo);
    const backup = createBackupService(repo);
    const exerciseId = EXERCISE_IDS.bodyweightSquat;
    const input = (date: string, seconds = 30): DayPlanInput => ({
      date, name: 'Regression fixture', timeZone: profile.timeZone, startTime: '12:00', durationMinutes: 1,
      exercises: [{ exerciseId, order: 0, targetSets: [{ metricType: 'reps', reps: 8 }], setTimings: [{ durationSeconds: seconds, restSeconds: 30 }] }],
    });
    const reject = async (operation: () => Promise<unknown>) => {
      try { await operation(); return ''; } catch (failure) { return (failure as { code?: string }).code ?? String(failure); }
    };
    const snapshot = async () => JSON.stringify(await Promise.all([db.plans.toArray(), db.planVersions.toArray(), db.scheduledWorkouts.toArray(), db.metadata.toArray()]));
    if (scenario === 'capacity') {
      await service.saveDayPlans([input('2099-01-01')], 0);
      const before = await snapshot();
      const huge = input('2099-01-03');
      huge.exercises[0].notes = 'x'.repeat(MAX_BACKUP_BYTES);
      const error = await reject(() => service.saveDayPlans([input('2099-01-02'), huge], 0));
      const unchanged = before === await snapshot();
      const priorStillExportable = (await reject(() => backup.exportBackup())) === '';
      return { error, unchanged, priorStillExportable };
    }
    const before = await snapshot();
    const excessive = await reject(() => service.saveDayPlans([input('2099-02-01'), input('2099-02-02', 31)], 0));
    const allRolledBack = before === await snapshot();
    const durationOnly = input('2099-02-03');
    durationOnly.exercises = [{ exerciseId: EXERCISE_IDS.plank, order: 0, targetSets: [{ metricType: 'duration', durationSeconds: 61 }] }];
    const knownTarget = await reject(() => service.saveDayPlans([durationOnly], 0));
    const [boundary] = await service.saveDayPlans([input('2099-02-04')], 0);
    const inherit = input('2099-02-04', 31);
    delete inherit.startTime; delete inherit.durationMinutes;
    const inherited = await reject(() => service.saveDayPlan({ ...inherit, id: boundary.plan.id, expectedRevision: boundary.plan.revision }));
    const unknown = input('2099-02-05'); delete unknown.exercises[0].setTimings;
    const [unknownSaved] = await service.saveDayPlans([unknown], 0);
    return { excessive, allRolledBack, knownTarget, boundaryDuration: boundary.task.durationMinutes, inherited, unknownTimingPreserved: unknownSaved.version.days[0].exercises[0].setTimings === undefined, exportable: (await reject(() => backup.exportBackup())) === '' };
  } finally { db.close(); await db.delete(); }
}
