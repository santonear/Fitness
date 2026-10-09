import Dexie from 'dexie';
import { createDatabase } from '../../../src/persistence/db';
import { createRepository } from '../../../src/persistence/repository';
import { createProfileService } from '../../../src/application/profile';
import { createBackupService } from '../../../src/application/backup';
import { createV8DataService } from '../../../src/persistence/v8-access';
import { createPlanService } from '../../../src/application/plans';
import type { BackupEnvelope } from '../../../src/domain/models';
import { v8WorkoutSchema } from '../../../src/domain/schemas';

const oldStores = { profiles: 'id', metadata: 'localProfileId', bodyWeights: 'id,localDate', plans: 'id,status,currentVersionId', planVersions: 'id,planId,[planId+versionNumber]',
  sessions: 'id,status,localDate,planVersionId', sets: 'id,sessionId,[sessionId+exerciseInstanceId]', scheduledWorkouts: 'id,planVersionId,scheduledDate,completedSessionId',
  trainingMemo: 'schemaVersion', aiMemoryNotes: 'id,memoRevision', timers: 'id,sessionId', mediaAssets: 'id', guidedStates: 'id', coachDevice: 'id' };
const device = { id: 'local', preferences: { enabled: false, dailyLimit: 0 as const, quietStart: '22:00', quietEnd: '08:00', timeZone: 'UTC', side: 'right' as const }, records: [], watermark: 0, snoozeUntil: 0, generation: 0, initializedAt: 0 };
const snapshot = (db: Dexie, omit: string[] = []) => db.transaction('r', db.tables, async () => JSON.stringify(await Promise.all(db.tables.filter(table => !omit.includes(table.name)).sort((a, b) => a.name.localeCompare(b.name)).map(async table => [table.name, await table.toArray()]))));

export async function verifyV8Migration(envelope: BackupEnvelope, failUpgrade = false) {
  const name = `v8-upgrade-${crypto.randomUUID()}`;
  const old = new Dexie(name); old.version(7).stores(oldStores);
  await old.open();
  await old.transaction('rw', old.tables, async () => {
    for (const table of old.tables) {
      const value = envelope.data[table.name as keyof typeof envelope.data];
      if (table.name === 'coachDevice') await table.bulkAdd([device]);
      else if (table.name === 'metadata' || table.name === 'trainingMemo') await table.bulkAdd([value]);
      else if (Array.isArray(value)) await table.bulkAdd(value);
      else if (value !== undefined) throw new Error('Expected a legacy collection');
    }
  });
  const before = await snapshot(old); const legacyBefore = await snapshot(old, ['metadata']); old.close();
  const db = createDatabase(name);
  if (failUpgrade) db.v8PlanVersions.hook('creating', () => { throw new Error('injected migration write failure'); });
  try {
    if (failUpgrade) {
      const rejected = await db.open().then(() => false, () => true); db.close();
      const inspect = new Dexie(name); await inspect.open();
      const unchanged = await snapshot(inspect) === before; const version = inspect.verno; inspect.close();
      return { rejected, unchanged, version };
    }
    await db.open();
    const omit = ['metadata', 'v8Plans', 'v8PlanVersions', 'v8Workouts', 'v8Activities', 'v8State'];
    const unchanged = await snapshot(db, omit) === legacyBefore;
    const repo = createRepository(db); const access = createV8DataService(repo);
    const notice = await access.getMigrationNotice(); await access.acknowledgeMigrationNotice();
    const versions = await db.v8PlanVersions.toArray(); const state = await db.v8State.get('v8');
    const migratedPlan = (await db.plans.toArray()).find(plan => !plan.deletedAt);
    const readOnly = migratedPlan ? await createPlanService(repo).renamePlan(migratedPlan.id, 'not permitted', migratedPlan.revision).then(() => false, () => true) : true;
    const first = await snapshot(db); db.close(); await db.open();
    const idempotent = await snapshot(db) === first;
    const history = await access.getLegacyHistory();
    const projected = await access.getReviewWorkouts();
    if (projected.legacyWorkouts.length !== history.length || projected.workouts.length !== 0) throw new Error('Legacy review projection lost or duplicated records');
    const invalidDurationsExcluded = history.filter(({ session }) => session.completedAt && (Date.parse(session.completedAt) < Date.parse(session.startedAt) || Date.parse(session.completedAt) - Date.parse(session.startedAt) > 43200000)).every(row => row.trainingSeconds === undefined);
    const workout = { id: crypto.randomUUID(), planVersionId: versions[0].id, templateId: versions[0].templates[0].id,
      startedAt: '2026-10-10T00:00:00.000Z', endedAt: '2026-10-10T00:00:00.000Z', localDate: '2026-10-10', timeZone: 'UTC',
      status: 'not_started' as const, plannedSetCount: 3, sets: [] };
    await repo.write(async () => { await db.v8Workouts.add(workout); });
    const noted = await access.appendWorkoutNote(workout.id, 'Append-only test note');
    const { appendedNotes, ...unchangedWorkout } = noted;
    const notesPreserved = JSON.stringify({ ...workout, ...unchangedWorkout }) === JSON.stringify(workout) && appendedNotes?.[0].text === 'Append-only test note';
    const { planVersionId: _plan, templateId: _template, ...free } = workout;
    await repo.write(async () => { await db.v8Workouts.add(v8WorkoutSchema.parse({ ...free, id: crypto.randomUUID() })); });
    const backup = createBackupService(repo); const exported = JSON.parse(await (await backup.exportBackup()).text());
    const target = createDatabase(`v8-restore-${crypto.randomUUID()}`); const targetRepo = createRepository(target);
    try {
      await createProfileService(targetRepo).initialize('en'); await target.coachDevice.put(device);
      const targetBackup = createBackupService(targetRepo);
      const restore = async (value: unknown) => {
        const validated = await targetBackup.validateBackup(new File([JSON.stringify(value)], 'fixture.json'));
        await targetBackup.importBackup(validated, { backupExported: true, replacementConfirmed: true, expectedRevision: validated.expectedRevision });
      };
      // Old envelope restore uses the same migration as the actual DB upgrade.
      await restore(envelope);
      const restoredVersions = await target.v8PlanVersions.toArray();
      const sameProjection = JSON.stringify(restoredVersions.map(({ createdAt: _at, ...version }) => version)) === JSON.stringify(versions.map(({ createdAt: _at, ...version }) => version));
      await restore(exported);
      const roundTrip = JSON.stringify(await target.v8State.get('v8')) === JSON.stringify(state) && JSON.stringify(await target.v8PlanVersions.toArray()) === JSON.stringify(versions)
        && JSON.stringify(await target.v8Workouts.toArray()) === JSON.stringify(await db.v8Workouts.toArray());
      const reminderPreserved = JSON.stringify(await target.coachDevice.get('local')) === JSON.stringify(device);
      const beforeFailedRestore = await snapshot(target);
      const reject = () => { throw new Error('injected restore write failure'); };
      target.v8State.hook('creating', reject);
      const restoreRejected = await restore(envelope).then(() => false, () => true);
      target.v8State.hook('creating').unsubscribe(reject);
      const restoreRolledBack = await snapshot(target) === beforeFailedRestore;
      return { unchanged, idempotent, readOnly, schemaVersion: (await db.metadata.toCollection().first())?.schemaVersion, envelopeVersion: exported.schemaVersion,
        planCount: versions.length, noticeCount: notice?.planCount ?? 0, noticeCleared: await access.getMigrationNotice() === undefined,
        historyCount: history.length, oldRestoreSame: sameProjection, roundTrip, reminderPreserved, restoreRejected, restoreRolledBack, invalidDurationsExcluded, notesPreserved };
    } finally { target.close(); await target.delete(); }
  } finally { db.close(); await db.delete(); }
}
