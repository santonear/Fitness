import { readFileSync, readdirSync } from 'node:fs';
import { expect, it } from 'vitest';
import { validateBackupEnvelope } from '../../../src/application/backup';
import { BACKUP_VERSION, DATABASE_VERSION } from '../../../src/domain/storage-version';
import { hasHouseholdSupport } from '../../../src/engine/equipment';
const directory = new URL('../../fixtures/legacy-backups/', import.meta.url);
it('continues to read every real legacy export without mutating source facts', () => {
  const files = readdirSync(directory).filter(name => name.endsWith('.json') && !name.includes('manifest'));
  expect(files.length).toBeGreaterThan(3);
  for (const name of files) {
    const original = JSON.parse(readFileSync(new URL(name, directory), 'utf8')),
      before = JSON.stringify(original);
    const restored = validateBackupEnvelope(original);
    expect(restored.format).toBe('fitness-local');
    expect(JSON.stringify(original)).toBe(before);
  }
});
it('round-trips an explicit support answer and rejects invalid values in the new envelope', () => {
  const original = JSON.parse(readFileSync(new URL('v8-main-pre-engine.json', directory), 'utf8'));
  const profile = original.data.v8.state.coachProfile;
  expect(profile).toBeTruthy();
  const envelope = {
    ...original,
    schemaVersion: BACKUP_VERSION,
    data: {
      ...original.data,
      metadata: { ...original.data.metadata, schemaVersion: DATABASE_VERSION },
      v8: {
        ...original.data.v8,
        state: { ...original.data.v8.state, coachProfile: { ...profile, householdSupport: false } },
      },
    },
  };
  const restored = validateBackupEnvelope(JSON.parse(JSON.stringify(envelope)));
  expect(restored.data.v8?.state.coachProfile?.householdSupport).toBe(false);
  expect(hasHouseholdSupport(restored.data.v8!.state.coachProfile!)).toBe(false);
  expect(restored.data.v8?.workouts).toEqual(original.data.v8.workouts);
  expect(() =>
    validateBackupEnvelope({
      ...envelope,
      data: {
        ...envelope.data,
        v8: {
          ...envelope.data.v8,
          state: { ...envelope.data.v8.state, coachProfile: { ...profile, householdSupport: 'yes' } },
        },
      },
    }),
  ).toThrow();
});
