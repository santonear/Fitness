import { createDatabase } from '../../../src/persistence/db';
import { createRepository } from '../../../src/persistence/repository';
import { createProfileService } from '../../../src/application/profile';
import { createBackupService, validateBackupEnvelope, MAX_BACKUP_BYTES } from '../../../src/application/backup';
import { synchronizeTrainingMemo } from '../../../src/application/training-memory';
import { exercises } from '../../../src/catalog/exercises';
import type { BackupEnvelope, ExerciseSnapshot, SetRecord, WorkoutSession } from '../../../src/domain/models';

const databases: ReturnType<typeof createDatabase>[] = [];
const notes = ['', 'Good / 良好', '节奏稳定\nsteady pace'.repeat(8), 'Long / 长备注 '.repeat(32)];
const metrics = [{ metricType: 'reps_load', reps: 8, loadGrams: 0 },
  { metricType: 'duration_distance', durationSeconds: 90, distanceMeters: 0 },
  { metricType: 'reps', reps: 10 }, { metricType: 'duration', durationSeconds: 60 }] as const;

async function isolated() {
  const db = createDatabase(`g1-capacity-${crypto.randomUUID()}`); databases.push(db);
  const repo = createRepository(db); await createProfileService(repo).initialize('en');
  return { db, repo, backup: createBackupService(repo) };
}

async function fullSnapshot(db: ReturnType<typeof createDatabase>): Promise<string> {
  return db.transaction('r', db.tables, async () => JSON.stringify(await Promise.all(
    db.tables.map(async table => ({ name: table.name, rows: await table.toArray() })),
  )));
}

export async function prepareCapacity(kind: 'small' | '5MiB' | '6MiB' | '8MiB' | '10000') {
  const { db, repo, backup } = await isolated();
  const count = kind === '10000' ? 100 : 1;
  const perSession = kind === '10000' ? 100 : 1;
  const stamp = '2026-10-04T00:00:00Z';
  const sessions: WorkoutSession[] = []; const sets: SetRecord[] = [];
  for (let i = 0; i < count; i++) {
    const snapshots: ExerciseSnapshot[] = exercises.map((exercise, order) => {
      const { steps: _steps, cautions: _cautions, ...data } = exercise;
      return { ...data, exerciseId: exercise.id as ExerciseSnapshot['exerciseId'], exerciseInstanceId: crypto.randomUUID(), order, targetSets: [] };
    });
    const session: WorkoutSession = { id: crypto.randomUUID(), revision: 0, createdAt: stamp, updatedAt: stamp,
      status: 'completed', startedAt: stamp, completedAt: stamp, localDate: '2026-10-04', timeZone: 'UTC',
      originalExerciseSnapshots: structuredClone(snapshots), exerciseSnapshots: snapshots };
    sessions.push(session);
    for (let j = 0; j < perSession; j++) {
      const index = j % 4;
      sets.push({ id: crypto.randomUUID(), revision: 0, createdAt: stamp, updatedAt: stamp, sessionId: session.id,
        exerciseInstanceId: snapshots[index].exerciseInstanceId, order: j, completed: true, ...metrics[index],
        notes: kind === '5MiB' ? 'x'.repeat(5 * 1024 * 1024) : kind === '6MiB' ? 'x'.repeat(6 * 1024 * 1024) : kind === '8MiB' ? 'x'.repeat(8 * 1024 * 1024) : notes[j % notes.length] });
    }
  }
  await repo.write(async () => { await db.sessions.bulkAdd(sessions); await db.sets.bulkAdd(sets); await synchronizeTrainingMemo(repo); });
  const start = performance.now();
  const envelope = await db.transaction('r', db.tables, async () => ({
    format: 'fitness-local', schemaVersion: 5, catalogVersion: 1, exportedAt: stamp,
    data: { metadata: await repo.readMetadata(), profiles: await db.profiles.toArray(), plans: await db.plans.toArray(),
      planVersions: await db.planVersions.toArray(), sessions: await db.sessions.toArray(), sets: await db.sets.toArray(),
      scheduledWorkouts: await db.scheduledWorkouts.toArray(), bodyWeights: await db.bodyWeights.toArray(),
      trainingMemo: (await db.trainingMemo.get(1))!, aiMemoryNotes: await db.aiMemoryNotes.toArray(),
      guidedStates: await db.guidedStates.toArray(), timers: await db.timers.toArray(), mediaAssets: await db.mediaAssets.toArray() },
  }));
  const checked = validateBackupEnvelope(envelope);
  const formatted = JSON.stringify(checked, null, 2); const compact = JSON.stringify(checked);
  const resourceMs = performance.now() - start;
  const beforeExport = await fullSnapshot(db);
  const exportStart = performance.now();
  const outcome = await backup.exportBackup().then(blob => ({ result: 'accepted', blob }),
    (e: { code: string }) => ({ result: e.code, blob: null }));
  const exportMs = performance.now() - exportStart;
  const libraryUnchanged = beforeExport === await fullSnapshot(db);
  const beforeFacts = canonicalFacts(checked);
  Object.assign(window, { g1Capacity: { backup, db, checked, beforeFacts } });
  const blob = outcome.blob;
  if (blob) {
    const a = document.createElement('a'); a.textContent = 'Download G1 synthetic backup'; a.id = 'g1-download';
    a.href = URL.createObjectURL(blob); a.download = `${kind}.json`; document.body.append(a);
  }
  const decodeStart = performance.now();
  validateBackupEnvelope(JSON.parse(formatted));
  const candidateCheckMs = performance.now() - decodeStart;
  const memory = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return { kind, limit: MAX_BACKUP_BYTES, sessions: count, sets: sets.length, exportResult: outcome.result,
    formattedBytes: new Blob([formatted]).size, compactBytes: new Blob([compact]).size,
    resourceMs, exportMs, candidateCheckMs, libraryUnchanged, heapBytes: memory?.usedJSHeapSize ?? null,
    fits16MiBProbe: new Blob([formatted]).size <= 16 * 1024 * 1024,
    candidateScope: 'Local candidate; actual download and isolated restore, no physical-phone evidence' };
}

function canonicalFacts(envelope: BackupEnvelope): string {
  const { metadata: _metadata, trainingMemo, ...data } = envelope.data;
  const { revision: _r, sourceRevision: _s, updatedAt: _t, ...memoFacts } = trainingMemo;
  function stable(value: unknown): unknown {
    if (Array.isArray(value)) {
      const array = value.map(stable);
      if (array.every(entry => entry && typeof entry === 'object' && 'id' in entry)) {
        array.sort((a, b) => String((a as { id: string }).id).localeCompare(String((b as { id: string }).id)));
      }
      return array;
    }
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => [key, stable(val)]));
    return value;
  }
  return JSON.stringify(stable({ ...data, memoFacts }));
}

export async function restoreDownloaded(text: string) {
  const previous = (window as unknown as { g1Capacity: { beforeFacts: string } }).g1Capacity;
  const { backup } = await isolated();
  // The destination is a synthetic empty library; still execute the real pre-restore export.
  const current = await backup.exportBackup();
  await backup.validateBackup(new File([current], 'current.json'));
  const started = performance.now();
  const validated = await backup.validateBackup(new File([text], 'downloaded.json', { type: 'application/json' }));
  await backup.importBackup(validated, { backupExported: true, replacementConfirmed: true, expectedRevision: validated.expectedRevision });
  const restored = validateBackupEnvelope(JSON.parse(await (await backup.exportBackup()).text()));
  return { factsEqual: previous.beforeFacts === canonicalFacts(restored), restoreMs: performance.now() - started,
    sessions: restored.data.sessions.length, sets: restored.data.sets.length };
}

export async function boundaryChecks() {
  const { backup } = await isolated(); const blob = await backup.exportBackup(); const text = await blob.text();
  const checks = [];
  for (const bytes of [MAX_BACKUP_BYTES - 1, MAX_BACKUP_BYTES, MAX_BACKUP_BYTES + 1]) {
    const raw = text + ' '.repeat(bytes - blob.size);
    checks.push({ bytes, result: await backup.validateBackup(new File([raw], 'boundary.json')).then(() => 'accepted', (e: { code: string }) => e.code) });
  }
  return checks;
}

export async function largeCurrentBlocksSmallRestore() {
  const state = (window as unknown as { g1Capacity: { backup: ReturnType<typeof createBackupService>; db: ReturnType<typeof createDatabase>; checked: BackupEnvelope; beforeFacts: string } }).g1Capacity;
  const small = await isolated(); const file = new File([await small.backup.exportBackup()], 'small.json');
  const before = await fullSnapshot(state.db);
  const preview = await state.backup.validateBackup(file);
  const exportResult = await state.backup.exportBackup().then(() => 'accepted', (e: { code: string }) => e.code);
  const replaceResult = await state.backup.importBackup(preview, { backupExported: false, replacementConfirmed: true, expectedRevision: preview.expectedRevision })
    .then(() => 'accepted', (e: { code: string }) => e.code);
  const set = await state.db.sets.toCollection().first();
  return { exportResult, replaceResult, sets: await state.db.sets.count(), noteBytes: new Blob([set?.notes ?? '']).size,
    libraryUnchanged: before === await fullSnapshot(state.db) };
}

export async function replaceLargeWithSmall() {
  const state = (window as unknown as { g1Capacity: { backup: ReturnType<typeof createBackupService>; db: ReturnType<typeof createDatabase> } }).g1Capacity;
  const small = await isolated();
  const preview = await state.backup.validateBackup(new File([await small.backup.exportBackup()], 'small.json'));
  const receipt = await state.backup.exportBackupWithReceipt();
  if (receipt.dataRevision !== preview.expectedRevision) throw new Error('Stale confirmation');
  await state.backup.importBackup(preview, { backupExported: true, replacementConfirmed: true, expectedRevision: preview.expectedRevision });
  return { sets: await state.db.sets.count(), sessions: await state.db.sessions.count() };
}

export async function staleExportConfirmation() {
  const { db, repo, backup } = await isolated();
  const preview = await backup.validateBackup(new File([await backup.exportBackup()], 'small.json'));
  const receipt = await backup.exportBackupWithReceipt();
  await repo.write(async () => { await db.bodyWeights.add({ id: crypto.randomUUID(), revision: 0, createdAt: '2026-10-05T00:00:00Z', updatedAt: '2026-10-05T00:00:00Z', timeZone: 'UTC', localDate: '2026-10-05', weightGrams: 60000 }); });
  const before = await fullSnapshot(db);
  const result = await backup.importBackup(preview, { backupExported: true, replacementConfirmed: true, expectedRevision: receipt.dataRevision }).then(() => 'accepted', (e: { code: string }) => e.code);
  return { result, unchanged: before === await fullSnapshot(db), receiptStale: receipt.dataRevision !== (await repo.readMetadata()).dataRevision };
}

export async function cleanupCapacity() {
  for (const db of databases.splice(0)) { const name = db.name; if (!name.startsWith('g1-capacity-')) throw new Error('Unexpected fixture database'); db.close(); await db.delete(); }
}
