import Dexie from 'dexie';
import { createDatabase } from '../../../src/persistence/db';
import { createRepository } from '../../../src/persistence/repository';
import { createProfileService } from '../../../src/application/profile';
import { createPlanService } from '../../../src/application/plans';
import { createProgressService } from '../../../src/application/progress';
import { createBackupService } from '../../../src/application/backup';
import { createWorkoutService } from '../../../src/application/workouts';
import { synchronizeTrainingMemo } from '../../../src/application/training-memory';
import type { PlanInput } from '../../../src/domain/models';

export async function calendarProvenance(name: string) {
  const db = createDatabase(name);
  try {
    const repo = createRepository(db);
    await createProfileService(repo).initialize('en');
    const plans = createPlanService(repo);
    const input: PlanInput = {
      name: 'Original calendar', source: 'manual', startDate: '2026-10-03', scheduleTimeZone: 'Asia/Shanghai',
      goalSnapshot: { goal: '' }, durationWeeks: 1, daysPerWeek: 1,
      days: [{ dayId: crypto.randomUUID(), weekIndex: 1, dayOfWeek: 6,
        exercises: [{ exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0, targetSets: [{ metricType: 'reps', reps: 10 }] }] }],
    };
    const plan = await plans.savePlan(input);
    const query = { from: '2026-10-03', to: '2026-10-10', timeZone: 'UTC', planVersionId: plan.currentVersionId };
    const now = Date.parse('2026-10-03T18:00:00Z');
    const before = (await createProgressService(repo).queryProgress(query, now)).dueCount;
    await plans.savePlan({ ...input, id: plan.id, startDate: '2026-10-10', scheduleTimeZone: 'America/Los_Angeles' }, plan.revision);
    const after = (await createProgressService(repo).queryProgress(query, now)).dueCount;
    const version = await db.planVersions.get(plan.currentVersionId);
    const backup = createBackupService(repo);
    const blob = await backup.exportBackup();
    const backupValid = !!(await backup.validateBackup(new File([blob], 'calendar.json')));
    return { before, after, startDate: (version as unknown as Record<string, unknown>).startDate,
      scheduleTimeZone: (version as unknown as Record<string, unknown>).scheduleTimeZone, backupValid };
  } finally {
    await db.transaction('r', db.tables, async () => { await db.planVersions.count(); });
    const connections = (Dexie as unknown as { connections: Dexie[] }).connections;
    for (const connection of [...connections]) if (connection.name === name) connection.close();
    db.close();
    await Dexie.delete(name);
  }
}

const legacyStores = {
  profiles: 'id', metadata: 'localProfileId', bodyWeights: 'id,localDate',
  plans: 'id,status,currentVersionId', planVersions: 'id,planId,[planId+versionNumber]',
  sessions: 'id,status,localDate,planVersionId', sets: 'id,sessionId,[sessionId+exerciseInstanceId]',
  scheduledWorkouts: 'id,planVersionId,scheduledDate,completedSessionId',
  trainingMemo: 'schemaVersion', aiMemoryNotes: 'id,memoRevision', timers: 'id,sessionId', mediaAssets: 'id',
};

export async function seedMissingProvenance() {
  const connections = (Dexie as unknown as { connections: Dexie[] }).connections;
  for (const connection of [...connections]) if (connection.name === 'fitness-local') connection.close();
  await Dexie.delete('fitness-local');
  const legacy = new Dexie('fitness-local');
  legacy.version(2).stores(legacyStores);
  await legacy.open();
  await legacy.table('planVersions').add({ id: crypto.randomUUID(), goalSnapshot: { goal: 'Keep legacy facts' } });
  legacy.close();
}

export async function readLegacyFacts() {
  const legacy = new Dexie('fitness-local');
  legacy.version(2).stores(legacyStores);
  await legacy.open();
  try {
    return await legacy.transaction('r', legacy.tables, async () => ({ versions: await legacy.table('planVersions').count(),
      goal: (await legacy.table('planVersions').toCollection().first()).goalSnapshot.goal, version: legacy.verno }));
  } finally { legacy.close(); }
}

export async function measureSetSave(name: string) {
  const db = createDatabase(name);
  try {
    const repo = createRepository(db);
    await createProfileService(repo).initialize('en');
    const service = createWorkoutService(repo);
    const template = await service.startWorkout({ sessionId: crypto.randomUUID(), localDate: '2026-10-03', timeZone: 'UTC',
      exerciseIds: ['d16325d9-fc00-4c41-88a1-000000000003'] });
    const timestamp = '2026-10-03T00:00:00Z';
    const sessions = Array.from({ length: 100 }, () => ({ ...template, id: crypto.randomUUID(), status: 'completed' as const,
      startedAt: timestamp, completedAt: timestamp, createdAt: timestamp, updatedAt: timestamp }));
    const records = sessions.flatMap(session => Array.from({ length: 100 }, (_, order) => ({
      id: crypto.randomUUID(), sessionId: session.id, exerciseInstanceId: session.exerciseSnapshots[0].exerciseInstanceId,
      order, metricType: 'reps' as const, reps: 10, completed: true, revision: 0, createdAt: timestamp, updatedAt: timestamp,
    })));
    await repo.write(async () => {
      await db.sessions.bulkAdd(sessions);
      await db.sets.bulkAdd(records);
      await synchronizeTrainingMemo(repo);
    });
    let current = template;
    const durations: number[] = [];
    for (let order = 0; order < 50; order++) {
      const before = performance.now();
      current = await service.recordSet(current.id, { id: crypto.randomUUID(), exerciseInstanceId: current.exerciseSnapshots[0].exerciseInstanceId,
        order, metricType: 'reps', reps: 12, completed: true }, current.revision);
      durations.push(performance.now() - before);
    }
    const historyStart = performance.now();
    const progress = await createProgressService(repo).queryProgress({ from: '2026-10-03', to: '2026-10-03', timeZone: 'UTC' }, Date.parse('2026-10-04T00:00:00Z'));
    const historyMs = performance.now() - historyStart;
    const sorted = [...durations].sort((a, b) => a - b);
    return await db.transaction('r', db.tables, async () => ({
      seedSessions: 100, seedSetRecords: 10_000, samples: durations.length,
      p95Ms: sorted[Math.ceil(sorted.length * .95) - 1], maxMs: sorted.at(-1), historyMs,
      historyCount: progress.history.length, persistedSets: await db.sets.count(),
    }));
  } finally {
    const connections = (Dexie as unknown as { connections: Dexie[] }).connections;
    for (const connection of [...connections]) if (connection.name === name) connection.close();
    db.close();
    await Dexie.delete(name);
  }
}
