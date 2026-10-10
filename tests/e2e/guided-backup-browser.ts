import Dexie from 'dexie';
import { createDatabase } from '../../src/persistence/db';
import { createRepository } from '../../src/persistence/repository';
import { createProfileService } from '../../src/application/profile';
import { createBackupService } from '../../src/application/backup';
import { emptyGuidedState, guidedStateSchema } from '../../src/domain/guided-contracts';
import { createDayPlanService } from '../../src/application/day-plans';

export async function verifyGuidedBackup(name: string) {
  const db = createDatabase(name); const other = createDatabase(name);
  try {
    const repo = createRepository(db); const profile = await createProfileService(repo).initialize('en');
    const staleRepo = createRepository(other); await staleRepo.readMetadata();
    const now = new Date().toISOString(); const eventId = crypto.randomUUID();
    const candidateId = crypto.randomUUID(); const programId = crypto.randomUUID();
    const plannedExercises = [{ exerciseId: 'd16325d9-fc00-4c41-88a1-000000000001' as const, order: 0,
      targetSets: [{ metricType: 'reps_load' as const, reps: 10, loadGrams: 2000 }] }];
    const saved = await createDayPlanService(repo).saveDayPlan({ name: 'Portable phase', date: '2026-10-07', timeZone: profile.timeZone, exercises: plannedExercises });
    await repo.write(async () => { await db.planVersions.put({ ...saved.version, goalSnapshot: { goal: 'Strength' } }); });
    const state = guidedStateSchema.parse({
      ...emptyGuidedState(), revision: 3,
      onboarding: { id: crypto.randomUUID(), step: 2, answers: { goal: { status: 'answered' as const, value: 'Strength' }, health: { status: 'skipped' as const } }, updatedAt: now, completed: false },
      candidates: [{ id: candidateId, name: 'Portable phase', goal: 'Strength', startDate: '2026-10-07', endDate: '2026-10-10', timeZone: profile.timeZone,
        days: [{ date: '2026-10-07', exercises: plannedExercises }], explanation: 'Available time', createdAt: now, restoreGeneration: 0 }],
      programs: [{ id: programId, name: 'Portable phase', goal: 'Strength', startDate: '2026-10-07', endDate: '2026-10-10', timeZone: profile.timeZone,
        status: 'paused' as const, revision: 1, planIds: [saved.plan.id], taskIds: [saved.task.id], candidateId, explanation: 'Available time', createdAt: now, updatedAt: now }],
      messages: [{ id: crypto.randomUUID(), conversationId: crypto.randomUUID(), role: 'user' as const, content: 'Keep this local', createdAt: now, programId, candidateId }],
      events: [{ id: eventId, programId, action: 'paused' as const, before: 'active', after: 'paused', createdAt: now }],
      observations: [{ id: crypto.randomUUID(), kind: 'waist' as const, unit: 'cm' as const, value: 81, localDate: '2026-10-07', timeZone: 'UTC', method: 'Tape', createdAt: now }],
      invitations: [{ id: crypto.randomUUID(), eventId, decision: 'declined' as const }],
    });
    await repo.write(async () => { await db.guidedStates.put(state); });
    const backup = createBackupService(repo);
    const blob = await backup.exportBackup(); const envelope = JSON.parse(await blob.text());
    const file = (value: unknown) => new File([JSON.stringify(value)], 'guided.json', { type: 'application/json' });
    const restore = async (value: unknown) => {
      const checked = await backup.validateBackup(file(value));
      return backup.importBackup(checked, { backupExported: true, replacementConfirmed: true, expectedRevision: checked.expectedRevision });
    };
    await repo.write(async () => { await db.guidedStates.clear(); });
    await restore(envelope);
    const preserved = JSON.stringify(await db.guidedStates.get('guided')) === JSON.stringify(state);
    const staleWriter = await staleRepo.write(async () => { await other.guidedStates.clear(); }).then(() => false, error => error.code === 'CONFLICT');
    const generation = (await repo.readMetadata()).restoreGeneration;
    const before = JSON.stringify(await Promise.all(db.tables.filter((table:{name:string})=>table.name!=='coachDevice').map(table => table.toArray())));
    const fail = () => { throw new DOMException('Storage full', 'QuotaExceededError'); };
    db.guidedStates.hook('creating', fail);
    const rejected = await restore(envelope).then(() => false, () => true);
    db.guidedStates.hook('creating').unsubscribe(fail);
    const rollback = rejected && before === JSON.stringify(await Promise.all(db.tables.filter((table:{name:string})=>table.name!=='coachDevice').map(table => table.toArray()))) && generation === (await repo.readMetadata()).restoreGeneration;
    const old = structuredClone(envelope); old.schemaVersion = 3; old.data.metadata.schemaVersion = 4; delete old.data.guidedStates; delete old.data.v8; delete old.data.nutritionRecords; delete old.data.activityImportReceipts;
    await restore(old);
    const oldCleared = await db.guidedStates.count() === 0;
    const upgraded = (await repo.readMetadata()).schemaVersion === 9;
    const noInventedProgram = (JSON.parse(await (await backup.exportBackup()).text()).data.guidedStates as unknown[]).length === 0;
    return { version: envelope.schemaVersion, preserved, staleWriter, rollback, oldCleared, upgraded, noInventedProgram };
  } finally {
    db.close(); other.close();
    for (const connection of [...(Dexie as unknown as { connections: Dexie[] }).connections]) if (connection.name === name) connection.close();
    await Dexie.delete(name);
  }
}
