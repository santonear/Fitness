import { DATABASE_VERSION, BACKUP_VERSION } from '../domain/storage-version';
import { includeAssistantBackup } from '../persistence/assistant-conversations';
import { migrateBodyProfile } from '../persistence/body-profile-migration';
import type { ImportReport, ReplaceConfirmation, ValidatedBackup } from '../domain/models';
import { DomainError } from '../domain/errors';
import { repository, type Repository } from '../persistence/repository';
import { synchronizeTrainingMemo } from './training-memory';
import { prepareV8Migration, writeV8Library } from '../persistence/v8-migration';
import { recoverAssistantSchedule } from '../persistence/assistant-schedule-migration';
import Dexie from 'dexie';
import { validateBackupEnvelope } from './backup/validate';
import { invalid } from './backup/checks';
import { repairYogaFlowTargets } from '../persistence/yoga-flow-repair';

// UTF-8 file bytes, not characters. Candidate verified on synthetic desktop data;
// physical-phone capacity support remains unverified.
export const MAX_BACKUP_BYTES = 16 * 1024 * 1024;
function checkBackupBytes(bytes: number): void {
  if (bytes > MAX_BACKUP_BYTES)
    throw new DomainError(
      'BACKUP_TOO_LARGE',
      `Backup exceeds ${MAX_BACKUP_BYTES} UTF-8 bytes (16 MiB). Existing data has not been replaced.`,
    );
}
export const restoreChannelName = 'fitness-library-replaced';
export const restoreEventName = 'fitness-library-restored';
export function restoreStorageKey(databaseName: string): string {
  return `${restoreChannelName}:${databaseName}`;
}
export { validateBackupEnvelope };

export function createBackupService(repo: Repository) {
  async function exportBackupWithReceipt(): Promise<{ blob: Blob; dataRevision: number; restoreGeneration: number }> {
    const envelope = await repo.db.transaction('r', repo.db.tables, async () => {
      const metadata = await repo.readMetadata();
      const sessions = await repo.db.sessions.toArray();
      const sets = await repo.db.sets.toArray();
      const versions = await repo.db.planVersions.toArray();
      const previousMemo = await repo.db.trainingMemo.get(1);
      return validateBackupEnvelope({
        format: 'fitness-local',
        schemaVersion: BACKUP_VERSION,
        catalogVersion: 1,
        exportedAt: new Date().toISOString(),
        data: {
          assistantConversations: includeAssistantBackup() ? await repo.db.assistantConversations.toArray() : [],
          exerciseFavorites: await repo.db.exerciseFavorites.toArray(),
          metadata,
          profiles: await repo.db.profiles.toArray(),
          plans: await repo.db.plans.toArray(),
          planVersions: versions,
          sessions,
          sets,
          scheduledWorkouts: await repo.db.scheduledWorkouts.toArray(),
          bodyWeights: await repo.db.bodyWeights.toArray(),
          aiMemoryNotes: await repo.db.aiMemoryNotes.toArray(),
          timers: await repo.db.timers.toArray(),
          mediaAssets: await repo.db.mediaAssets.toArray(),
          guidedStates: await repo.db.guidedStates.toArray(),
          nutritionRecords: await repo.db.nutritionRecords.toArray(),
          activityImportReceipts: await repo.db.activityImportReceipts.toArray(),
          fitnessTests: await repo.db.fitnessTests.toArray(),
          journeys: await repo.db.journeys.toArray(),
          futureLetters: await repo.db.futureLetters.toArray(),
          v8: {
            state: await repo.db.v8State.get('v8'),
            plans: await repo.db.v8Plans.toArray(),
            planVersions: await repo.db.v8PlanVersions.toArray(),
            workouts: await repo.db.v8Workouts.toArray(),
            activities: await repo.db.v8Activities.toArray(),
            planReferences: await repo.db.v8PlanReferences.toArray(),
          },
          trainingMemo: {
            schemaVersion: 1,
            revision: previousMemo?.revision ?? 0,
            sourceRevision: metadata.dataRevision,
            updatedAt: new Date().toISOString(),
            sessions: sessions.map(session => ({
              session,
              sets: sets.filter(set => set.sessionId === session.id).sort((a, b) => a.order - b.order),
              ...(session.planVersionId
                ? { planVersionSnapshot: versions.find(version => version.id === session.planVersionId) }
                : {}),
            })),
          },
        },
      });
    });
    const blob = new Blob([JSON.stringify(envelope, null, 2)], { type: 'application/json' });
    checkBackupBytes(blob.size);
    return {
      blob,
      dataRevision: envelope.data.metadata.dataRevision,
      restoreGeneration: envelope.data.metadata.restoreGeneration ?? 0,
    };
  }

  async function exportBackup(): Promise<Blob> {
    return (await exportBackupWithReceipt()).blob;
  }

  async function validateBackup(file: File): Promise<ValidatedBackup> {
    checkBackupBytes(file.size);
    let text: string;
    try {
      text = await file.text();
    } catch (reason) {
      throw new DomainError(
        'BACKUP_INVALID',
        `Cannot read backup file: ${String(reason)}. Select an accessible local file and try again.`,
      );
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch {
      throw new DomainError('BACKUP_INVALID', 'Backup is not valid JSON');
    }
    return { envelope: validateBackupEnvelope(value), expectedRevision: (await repo.readMetadata()).dataRevision };
  }

  async function importBackup(input: ValidatedBackup, confirmation: ReplaceConfirmation): Promise<ImportReport> {
    if (
      !confirmation.backupExported ||
      !confirmation.replacementConfirmed ||
      confirmation.expectedRevision !== input.expectedRevision
    ) {
      throw new DomainError(
        'BACKUP_CONFIRMATION_REQUIRED',
        'Download and keep the current backup, then confirm complete replacement',
      );
    }
    const envelope = validateBackupEnvelope(input.envelope);
    checkBackupBytes(new Blob([JSON.stringify(envelope)]).size);
    const v8 = envelope.data.v8 ?? (await prepareV8Migration(envelope.data, new Date().toISOString()));
    const recovered = recoverAssistantSchedule(
      v8.planVersions,
      envelope.data.assistantConversations ?? [],
      new Date().toISOString(),
    );
    const recoveredById = new Map(recovered.map(version => [version.id, version]));
    const scheduled = v8.planVersions.map(version => recoveredById.get(version.id) ?? version);
    // An older backup's yoga flows get the same idempotent repair as the database (yoga-flow-repair).
    const repaired = new Map(repairYogaFlowTargets(scheduled).map(version => [version.id, version]));
    const restoredV8 =
      recovered.length || repaired.size
        ? { ...v8, planVersions: scheduled.map(version => repaired.get(version.id) ?? version) }
        : v8;
    let committedGeneration = 0;
    await repo.write(async () => {
      const before = await repo.readMetadata();
      committedGeneration = (before.restoreGeneration ?? 0) + 1;
      if (!Number.isSafeInteger(committedGeneration) || !Number.isSafeInteger(before.dataRevision + 1))
        invalid('Local revision counter exhausted');
      // Device reminder preferences and suppression ledger are not portable training facts.
      // trainingCheckins are cleared and never exported: short-retention health check-ins (kept 10 days, deload.checkin.inputs) are intentionally not portable.
      for (const table of repo.db.tables) if (table.name !== 'coachDevice') await table.clear();
      const data = envelope.data;
      await repo.db.metadata.put({
        ...data.metadata,
        schemaVersion: DATABASE_VERSION,
        revision: before.revision,
        dataRevision: before.dataRevision,
        restoreGeneration: committedGeneration,
        importedAt: new Date().toISOString(),
      });
      await repo.db.profiles.bulkAdd(
        data.profiles.map(profile =>
          migrateBodyProfile(
            profile,
            data.guidedStates?.find(row => row.id === 'guided'),
            new Date().toISOString(),
          ),
        ),
      );
      await repo.db.assistantConversations.bulkAdd(data.assistantConversations ?? []);
      await repo.db.exerciseFavorites.bulkAdd(data.exerciseFavorites ?? []);
      await repo.db.plans.bulkAdd(data.plans);
      await repo.db.planVersions.bulkAdd(data.planVersions);
      await repo.db.sessions.bulkAdd(data.sessions);
      await repo.db.sets.bulkAdd(data.sets);
      // Retained raw durations are intentionally wider than the editable scheduling model.
      await Dexie.currentTransaction!.table('scheduledWorkouts').bulkAdd(data.scheduledWorkouts);
      await repo.db.bodyWeights.bulkAdd(data.bodyWeights);
      await repo.db.aiMemoryNotes.bulkAdd(data.aiMemoryNotes);
      await repo.db.timers.bulkAdd(data.timers);
      await repo.db.mediaAssets.bulkAdd(data.mediaAssets);
      if (data.guidedStates) await repo.db.guidedStates.bulkAdd(data.guidedStates);
      await repo.db.trainingMemo.put(data.trainingMemo);
      await writeV8Library(Dexie.currentTransaction!, restoredV8);
      await repo.db.nutritionRecords.bulkAdd(data.nutritionRecords ?? []);
      await repo.db.activityImportReceipts.bulkAdd(data.activityImportReceipts ?? []);
      await repo.db.fitnessTests.bulkAdd(data.fitnessTests ?? []);
      await repo.db.journeys.bulkAdd(data.journeys ?? []);
      await repo.db.futureLetters.bulkAdd(data.futureLetters ?? []);
      await synchronizeTrainingMemo(repo);
    }, input.expectedRevision);
    // Synchronous observers remove stale forms before this repository adopts the new generation.
    if (typeof window !== 'undefined')
      window.dispatchEvent(new CustomEvent(restoreEventName, { detail: { databaseName: repo.db.name } }));
    repo.adoptGeneration(committedGeneration);
    try {
      localStorage.setItem(
        restoreStorageKey(repo.db.name),
        JSON.stringify({ generation: committedGeneration, eventId: crypto.randomUUID() }),
      );
    } catch {
      /* BroadcastChannel and the same-tab reload remain available without localStorage. */
    }
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(restoreChannelName);
      channel.postMessage({ databaseName: repo.db.name, generation: committedGeneration });
      channel.close();
    }
    return {
      importedPlans: envelope.data.plans.length,
      importedSessions: envelope.data.sessions.length,
      rebuiltMemo: true,
    };
  }
  return { exportBackup, exportBackupWithReceipt, validateBackup, importBackup };
}

export const backupService = createBackupService(repository);
export const { exportBackup, validateBackup, importBackup } = backupService;
