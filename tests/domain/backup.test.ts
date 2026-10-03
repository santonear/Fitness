import { describe, expect, it } from 'vitest';
import { validateBackupEnvelope } from '../../src/application/backup';
import { DomainError } from '../../src/domain/errors';

const profileId = '00000000-0000-4000-8000-000000000001';
const timestamp = '2026-10-03T00:00:00Z';
const envelope = {
  format: 'fitness-local', schemaVersion: 2, catalogVersion: 1, exportedAt: timestamp,
  data: {
    metadata: { schemaVersion: 2, catalogVersion: 1, localProfileId: profileId, revision: 1, dataRevision: 1 },
    profiles: [{ id: profileId, revision: 0, createdAt: timestamp, updatedAt: timestamp, locale: 'en', timeZone: 'UTC', units: 'metric' }],
    plans: [], planVersions: [], sessions: [], sets: [], scheduledWorkouts: [], bodyWeights: [], timers: [], aiMemoryNotes: [],
    trainingMemo: { schemaVersion: 1, revision: 0, sourceRevision: 1, updatedAt: timestamp, sessions: [] },
  },
};

describe('JSON backup contract', () => {
  it('accepts a complete first-version JSON envelope', () => {
    expect(() => validateBackupEnvelope(envelope)).not.toThrow();
  });
  it('rejects undocumented old JSON and leaves migration to real DB upgrades', () => {
    expect(() => validateBackupEnvelope({ ...envelope, schemaVersion: 1 })).toThrow(/version/i);
  });
  it('rejects duplicate profile identity and unknown top-level credentials', () => {
    expect(() => validateBackupEnvelope({ ...envelope, data: { ...envelope.data, profiles: [...envelope.data.profiles, ...envelope.data.profiles] } })).toThrow(DomainError);
    expect(() => validateBackupEnvelope({ ...envelope, token: 'must not enter a backup' })).toThrow(DomainError);
  });
  it('rejects impossible calendar dates', () => {
    expect(() => validateBackupEnvelope({ ...envelope, data: { ...envelope.data, bodyWeights: [{ id: '00000000-0000-4000-8000-000000000002', revision: 0, createdAt: timestamp, updatedAt: timestamp, timeZone: 'UTC', localDate: '2026-02-30', weightGrams: 60000 }] } })).toThrow(DomainError);
  });
  it('rejects invalid embedded memo plan provenance instead of importing it', () => {
    const versionId = '00000000-0000-4000-8000-000000000003';
    const dayId = '00000000-0000-4000-8000-000000000004';
    const entry = {
      session: { id: '00000000-0000-4000-8000-000000000005', revision: 0, createdAt: timestamp, updatedAt: timestamp,
        status: 'in_progress', startedAt: timestamp, localDate: '2026-10-03', timeZone: 'UTC', planVersionId: versionId,
        plannedDayId: dayId, originalExerciseSnapshots: [], exerciseSnapshots: [] },
      sets: [],
      planVersionSnapshot: { id: versionId, planId: '00000000-0000-4000-8000-000000000006', revision: 0, createdAt: timestamp,
        updatedAt: timestamp, versionNumber: 1, goalSnapshot: { goal: 'Training' }, durationWeeks: 1, daysPerWeek: 2,
        days: [{ dayId, weekIndex: 1, dayOfWeek: 6, exercises: [{ exerciseId: 'd16325d9-fc00-4c41-88a1-000000000001', order: 0,
          targetSets: [{ metricType: 'reps_load', reps: 10, loadGrams: 2000 }] }] }] },
    };
    expect(() => validateBackupEnvelope({ ...envelope, data: { ...envelope.data, trainingMemo: { ...envelope.data.trainingMemo, sessions: [entry] } } })).toThrow(DomainError);
  });
});
