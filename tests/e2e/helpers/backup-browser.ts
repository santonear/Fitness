import Dexie from 'dexie';
import { createDatabase } from '../../../src/persistence/db';
import { createRepository } from '../../../src/persistence/repository';
import { createProfileService } from '../../../src/application/profile';
import { createWorkoutService } from '../../../src/application/workouts';
import { createBackupService, MAX_BACKUP_BYTES } from '../../../src/application/backup';
import { exercises } from '../../../src/catalog/exercises';
import { createPlanService } from '../../../src/application/plans';

function closeTestConnections(name: string): void {
  const connections = (Dexie as unknown as { connections: Dexie[] }).connections;
  for (const connection of [...connections]) {
    if (connection.name === name) connection.close();
  }
}

export async function verifyBackup(name: string) {
  const db = createDatabase(name);
  const second = createDatabase(name);
  try {
    const repo = createRepository(db);
    const profileService = createProfileService(repo);
    await profileService.initialize('en');
    const staleRepo = createRepository(second);
    await staleRepo.readMetadata();
    const workouts = createWorkoutService(repo);
    await createPlanService(repo).savePlan({ name: 'Portable plan', source: 'manual', startDate: '2026-10-03', scheduleTimeZone: 'UTC', goalSnapshot: { goal: 'Strength' }, durationWeeks: 1, daysPerWeek: 1, days: [{ dayId: crypto.randomUUID(), weekIndex: 1, dayOfWeek: 6, exercises: [{ exerciseId: 'd16325d9-fc00-4c41-88a1-000000000001', order: 0, targetSets: [{ metricType: 'reps_load', reps: 10, loadGrams: 2000 }] }] }] });
    const session = await workouts.startWorkout({ sessionId: crypto.randomUUID(), localDate: '2026-10-03', timeZone: 'Asia/Shanghai', exerciseIds: [exercises[0].id] });
    const set = { id: crypto.randomUUID(), exerciseInstanceId: session.exerciseSnapshots[0].exerciseInstanceId, order: 0, metricType: 'reps_load' as const, reps: 10, loadGrams: 2000, completed: true };
    const saved = await workouts.recordSet(session.id, set, session.revision);
    await workouts.completeWorkout(session.id, saved.revision);
    const now = new Date().toISOString();
    await repo.write(async () => {
      await db.aiMemoryNotes.put({ id: crypto.randomUUID(), revision: 0, createdAt: now, updatedAt: now, memoRevision: 1, generatorVersion: 'test', locale: 'en', suggestion: 'Independent advice', explanation: 'Keep separately' });
    });
    const service = createBackupService(repo);
    const exported = await service.exportBackup();
    const envelope = JSON.parse(await exported.text());
    envelope.data.trainingMemo.sessions = [];
    const file = () => new File([JSON.stringify(envelope)], 'backup.json', { type: 'application/json' });
    const checked = await service.validateBackup(file());
    const confirm = { backupExported: true, replacementConfirmed: true, expectedRevision: checked.expectedRevision };
    const confirmations = await service.importBackup(checked, { ...confirm, replacementConfirmed: false }).then(() => false, e => e.code === 'BACKUP_CONFIRMATION_REQUIRED');
    const beforeRevision = (await repo.readMetadata()).dataRevision;
    await service.importBackup(checked, confirm);
    const importedRevision = (await repo.readMetadata()).dataRevision;
    const memo = (await db.trainingMemo.get(1))!;
    const restored = (await db.sets.get(set.id))?.loadGrams === 2000;
    const memoRebuilt = memo.sessions.length === 1 && memo.sessions[0].sets[0].reps === 10 && memo.sourceRevision === importedRevision;
    const notesPreserved = (await db.aiMemoryNotes.toArray())[0].suggestion === 'Independent advice';
    const staleProfile = (await second.profiles.toCollection().first())!;
    const staleWriter = await createProfileService(staleRepo).saveProfile({ locale: 'en', timeZone: 'UTC', units: 'metric' }, staleProfile.revision).then(() => false, e => e.code === 'CONFLICT');
    const checks: boolean[] = [];
    const reject = async (content: string | Blob, code: string) => {
      checks.push(await service.validateBackup(new File([content], 'invalid.json')).then(() => false, e => e.code === code));
    };
    await reject('{broken', 'BACKUP_INVALID');
    await reject(new Blob([' '.repeat(MAX_BACKUP_BYTES + 1)]), 'BACKUP_TOO_LARGE');
    await reject(JSON.stringify({ ...envelope, schemaVersion: 999 }), 'BACKUP_VERSION_UNSUPPORTED');
    await reject(JSON.stringify({ ...envelope, schemaVersion: 1 }), 'BACKUP_VERSION_UNSUPPORTED');
    const mutate = async (change: (copy: typeof envelope) => void) => {
      const copy = structuredClone(envelope);
      change(copy);
      checks.push(await service.validateBackup(new File([JSON.stringify(copy)], 'invalid.json')).then(() => false, () => true));
    };
    await mutate(copy => { copy.data.sessions.push(copy.data.sessions[0]); });
    await mutate(copy => { copy.data.sets[0].sessionId = crypto.randomUUID(); });
    await mutate(copy => { copy.data.sessions[0].exerciseSnapshots[0].exerciseId = crypto.randomUUID(); });
    await mutate(copy => { copy.data.sessions[0].localDate = '2026-02-30'; });
    await mutate(copy => { copy.data.sessions[0].exerciseSnapshots[0].metricType = 'duration'; });
    await mutate(copy => { copy.data.sets[0].order = 0; copy.data.sets.push({ ...copy.data.sets[0], id: crypto.randomUUID() }); });
    await mutate(copy => { copy.data.sessions[0].status = 'in_progress'; copy.data.sessions[0].completedAt = undefined; copy.data.sessions.push({ ...copy.data.sessions[0], id: crypto.randomUUID() }); });
    await mutate(copy => { copy.data.timers.push({ id: crypto.randomUUID(), revision: 0, createdAt: now, updatedAt: now, sessionId: session.id, exerciseInstanceId: set.exerciseInstanceId, kind: 'rest', status: 'running', accumulatedMs: 0 }); });
    await mutate(copy => { copy.data.aiMemoryNotes.push(copy.data.aiMemoryNotes[0]); });
    await mutate(copy => { copy.data.plans[0].currentVersionId = crypto.randomUUID(); });
    await mutate(copy => { copy.data.planVersions[0].days[0].exercises[0].targetSets[0] = { metricType: 'duration', durationSeconds: 30 }; });
    await mutate(copy => { copy.data.planVersions[0].daysPerWeek = 2; });
    await mutate(copy => { copy.data.scheduledWorkouts[0].originalDate = '2026-10-04'; });
    await mutate(copy => { copy.data.scheduledWorkouts[0].completedSessionId = session.id; });
    await mutate(copy => { copy.data.trainingMemo.sessions = [memo.sessions[0], memo.sessions[0]]; });
    await mutate(copy => { copy.data.trainingMemo.sessions = [memo.sessions[0]]; copy.data.trainingMemo.sessions[0].sets.push(memo.sessions[0].sets[0]); });
    const preview = await service.validateBackup(file());
    await repo.write(async () => { await db.bodyWeights.put({ id: crypto.randomUUID(), revision: 0, createdAt: now, updatedAt: now, localDate: '2026-10-02', timeZone: 'UTC', weightGrams: 65000 }); });
    const stalePreview = await service.importBackup(preview, { ...confirm, expectedRevision: preview.expectedRevision }).then(() => false, e => e.code === 'CONFLICT');
    const fresh = await service.validateBackup(file());
    const before = JSON.stringify(await Promise.all(db.tables.filter((table:{name:string})=>table.name!=='coachDevice').map(table => table.toArray())));
    const fail = () => { throw new DOMException('Storage full', 'QuotaExceededError'); };
    db.sets.hook('creating', fail);
    await service.importBackup(fresh, { ...confirm, expectedRevision: fresh.expectedRevision }).catch(() => {});
    db.sets.hook('creating').unsubscribe(fail);
    const result = await db.transaction('r', db.tables, async () => {
      const rollback = before === JSON.stringify(await Promise.all(db.tables.filter((table:{name:string})=>table.name!=='coachDevice').map(table => table.toArray())));
      return { restored, memoRebuilt, notesPreserved, invalidRejected: checks.every(Boolean), confirmations, stalePreview, rollback, staleWriter, monotonic: importedRevision === beforeRevision + 1 };
    });
    await second.transaction('r', second.tables, async () => { await second.metadata.count(); });
    return result;
  } finally {
    db.close();
    second.close();
    closeTestConnections(name);
    await Dexie.delete(name);
  }
}
