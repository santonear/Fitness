import { createDatabase } from '../../src/persistence/db';
import { createRepository } from '../../src/persistence/repository';
import { createProfileService } from '../../src/application/profile';
import { createGuidedService } from '../../src/application/guided';
import { createWorkoutService } from '../../src/application/workouts';
import { createBackupService } from '../../src/application/backup';
import { captureGuidedHistory } from '../../src/application/guided-history';
import { exercises } from '../../src/catalog/exercises';
import type { ProgramCandidate } from '../../src/domain/guided-contracts';
import Dexie from 'dexie';
import { createPlanService } from '../../src/application/plans';
import { createDayPlanService } from '../../src/application/day-plans';

async function scenario(kind: string) {
  const db = createDatabase(`guided-test-${crypto.randomUUID()}`); const repo = createRepository(db); const profile = await createProfileService(repo).initialize('zh');
  const guided = createGuidedService(repo); const workouts = createWorkoutService(repo); const backups = createBackupService(repo);
  const exercise = exercises.find(item => item.metricType === 'reps')!;
  async function candidate(name: string, dates = ['2099-01-01', '2099-01-03']) {
    const value: ProgramCandidate = { id: crypto.randomUUID(), name, goal: 'synthetic goal', startDate: dates[0], endDate: dates.at(-1)!, timeZone: profile.timeZone,
      days: dates.map(date => ({ date, exercises: [{ exerciseId: exercise.id as ProgramCandidate['days'][number]['exercises'][number]['exerciseId'], order: 0, targetSets: [{ metricType: 'reps', reps: 8 }] }] })), explanation: 'synthetic fixture', createdAt: new Date().toISOString(), restoreGeneration: 0, ...(await guided.captureDependencies()) };
    await guided.retainCandidate(value, (await guided.read()).revision); return value;
  }
  async function reject(operation: () => Promise<unknown>) { try { await operation(); return false; } catch { return true; } }
  try {
    if (kind === 'answers') {
      await guided.saveAnswer('age', { status: 'skipped' }, 1, 0);
      const c = await candidate('before change'); await guided.saveAnswer('goal', { status: 'answered', value: 'changed' }, 2, (await guided.read()).revision);
      const stateRevision = (await guided.read()).revision;
      const rejected = await reject(() => guided.applyCandidate(c.id, stateRevision, 2));
      return { rejected, programs: (await guided.read()).programs.length, answered: (await guided.read()).onboarding?.answers };
    }
    const first = await candidate('first'); const programId = await guided.applyCandidate(first.id, (await guided.read()).revision, 2);
    const program = (await guided.read()).programs.find(item => item.id === programId)!; const tasks = await db.scheduledWorkouts.toArray();
    if (kind === 'protected') {
      const child = (await db.plans.get(program.planIds[0]))!;
      const before = JSON.stringify(await db.plans.toArray());
      const deleteDenied = await reject(() => createPlanService(repo).deletePlan(child.id, child.revision));
      const planPreserved = JSON.stringify(await db.plans.toArray()) === before;
      const dayBefore = JSON.stringify(await Promise.all([db.plans.toArray(), db.planVersions.toArray(), db.scheduledWorkouts.toArray()]));
      const modifiedExercises = structuredClone(first.days[0].exercises);
      modifiedExercises[0].targetSets = [{ metricType: 'reps', reps: 99 }];
      let editCode: string | undefined;
      try {
        await createDayPlanService(repo).saveDayPlan({ id: child.id, expectedRevision: child.revision, name: child.name,
          date: child.startDate, timeZone: child.scheduleTimeZone, exercises: modifiedExercises });
      } catch (error) { editCode = (error as { code?: string }).code; }
      const dayPreserved = dayBefore === JSON.stringify(await Promise.all([db.plans.toArray(), db.planVersions.toArray(), db.scheduledWorkouts.toArray()]));
      const pending = await candidate('before restore', ['2099-03-01']);
      const blob = await backups.exportBackup(); const checked = await backups.validateBackup(new File([blob], 'protected.json'));
      await backups.importBackup(checked, { backupExported: true, replacementConfirmed: true, expectedRevision: checked.expectedRevision });
      const restoredRevision = (await guided.read()).revision;
      const staleCandidateDenied = await reject(() => guided.applyCandidate(pending.id, restoredRevision, 2));
      return { deleteDenied, planPreserved, editCode, dayPreserved, backup: checked.envelope.schemaVersion, staleCandidateDenied,
        generation: (await repo.readMetadata()).restoreGeneration, programs: (await guided.read()).programs.length };
    }
    if (kind === 'collision') {
      await guided.transition(programId, 'paused', (await guided.read()).revision);
      const collisionDate = first.days[0].date;
      const weekday = new Date(`${collisionDate}T00:00:00Z`).getUTCDay() || 7;
      // Synthetic external occupancy fixture: create a valid draft first, then inject its active status.
      // This simulates a foreign write after pause; it does not bypass a product confirmation flow.
      const foreign = await createPlanService(repo).savePlan({ name: 'Foreign occupancy', source: 'manual', status: 'draft',
        startDate: collisionDate, scheduleTimeZone: profile.timeZone, goalSnapshot: { goal: 'Foreign goal' }, durationWeeks: 1, daysPerWeek: 1,
        days: [{ dayId: crypto.randomUUID(), weekIndex: 1, dayOfWeek: weekday, exercises: first.days[0].exercises }] });
      await repo.write(async () => { await db.plans.put({ ...foreign, status: 'active' }); });
      const before = JSON.stringify(await guided.read());
      let conflictCode: string | undefined;
      try { await guided.transition(programId, 'active', (await guided.read()).revision); }
      catch (error) { conflictCode = (error as { code?: string }).code; }
      const preserved = JSON.stringify(await guided.read()) === before;
      const blob = await backups.exportBackup(); await backups.validateBackup(new File([blob], 'collision.json'));
      return { conflictCode, preserved, status: (await guided.read()).programs.find(item => item.id === programId)?.status, foreign: (await db.plans.get(foreign.id))?.status };
    }
    if (kind === 'pause') {
      await guided.transition(programId, 'paused', (await guided.read()).revision);
      const rejected = await reject(() => workouts.startWorkout({ sessionId: crypto.randomUUID(), localDate: tasks[0].scheduledDate, timeZone: profile.timeZone, scheduledWorkoutId: tasks[0].id }));
      const available = await workouts.listAvailableSchedule(); await guided.transition(programId, 'active', (await guided.read()).revision);
      const resumed = await workouts.startWorkout({ sessionId: crypto.randomUUID(), localDate: tasks[0].scheduledDate, timeZone: profile.timeZone, scheduledWorkoutId: tasks[0].id });
      return { rejected, available: available.length, resumed: resumed.status, tasks: (await db.scheduledWorkouts.toArray()).map(item => item.originalDate).sort() };
    }
    if (kind === 'rollback') {
      const conflicting = await candidate('bad metrics', ['2099-01-08', '2099-01-09']); conflicting.days[1].exercises[0].targetSets = [{ metricType: 'duration', durationSeconds: 10 }];
      await db.guidedStates.update('guided', state => { state.candidates[state.candidates.length - 1] = conflicting; });
      const before = JSON.stringify((await db.plans.toArray()).map(item => [item.id, item.status]));
      const revision = (await guided.read()).revision;
      const failed = await reject(() => guided.applyCandidate(conflicting.id, revision, 2));
      return { failed, preserved: JSON.stringify((await db.plans.toArray()).map(item => [item.id, item.status])) === before, count: await db.plans.count(), current: (await guided.read()).programs.find(item => item.id === programId)?.status };
    }
    const session = await workouts.startWorkout({ sessionId: crypto.randomUUID(), localDate: tasks[0].scheduledDate, timeZone: profile.timeZone, scheduledWorkoutId: tasks[0].id });
    const snapshot = session.exerciseSnapshots[0];
    const saved = await workouts.recordSet(session.id, { id: crypto.randomUUID(), exerciseInstanceId: snapshot.exerciseInstanceId, order: 0, metricType: 'reps', reps: 8, completed: true }, session.revision);
    if (kind === 'history') {
      const before = await repo.readMetadata();
      const first = await captureGuidedHistory(repo, '2099-01-01', '2099-01-03', 32768);
      const readOnly = (await repo.readMetadata()).dataRevision === before.dataRevision;
      await guided.saveAnswer('preferences', { status: 'answered', value: 'local-only change' }, 0, (await guided.read()).revision);
      const second = await captureGuidedHistory(repo, '2099-01-01', '2099-01-03', 32768);
      const beforeLimit = (await repo.readMetadata()).dataRevision;
      const bounded = await reject(() => captureGuidedHistory(repo, '2099-01-01', '2099-01-03', 10));
      const payload = JSON.parse(second);
      return { readOnly, same: first === second, bounded, limitReadOnly: (await repo.readMetadata()).dataRevision === beforeLimit,
        sessions: payload.sessions.length, sets: payload.sets.length, status: payload.sessions[0].status, localAnswersExcluded: !second.includes('local-only change') };
    }
    if (kind === 'workout') {
      await guided.workoutTransition(session.id, true, (await guided.read()).revision);
      const rejected = await reject(() => workouts.recordSet(session.id, { id: crypto.randomUUID(), exerciseInstanceId: snapshot.exerciseInstanceId, order: 1, metricType: 'reps', reps: 9, completed: true }, saved.revision));
      await guided.workoutTransition(session.id, false, (await guided.read()).revision); await workouts.completeWorkout(session.id, saved.revision);
      const state = await guided.read(); return { rejected, sets: await db.sets.count(), session: (await db.sessions.get(session.id))?.status, events: state.events.map(item => item.action) };
    }
    if (kind === 'replace') {
      const second = await candidate('second', ['2099-02-01', '2099-02-03']); await guided.applyCandidate(second.id, (await guided.read()).revision, 2);
      const nextTask = (await db.scheduledWorkouts.toArray()).find(item => item.scheduledDate === '2099-02-01')!;
      const denied = await reject(() => workouts.startWorkout({ sessionId: crypto.randomUUID(), localDate: '2099-02-01', timeZone: profile.timeZone, scheduledWorkoutId: nextTask.id }));
      const blob = await backups.exportBackup(); const validated = await backups.validateBackup(new File([blob], 'guided.json'));
      return { old: (await guided.read()).programs.find(item => item.id === programId)?.status, sessionUnchanged: JSON.stringify(await db.sessions.get(session.id)) === JSON.stringify(saved), denied, sets: await db.sets.count(), backup: validated.envelope.schemaVersion };
    }
    throw new Error('Unknown scenario');
  } finally {
    db.close();
    for (const connection of [...(Dexie as unknown as { connections: Dexie[] }).connections]) if (connection.name === db.name) connection.close();
    await Dexie.delete(db.name);
  }
}
declare global { interface Window { guidedScenario: typeof scenario } }
window.guidedScenario = scenario;
