import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateBackupEnvelope } from '../../src/application/backup';

const root = new URL('../fixtures/legacy-backups/', import.meta.url);
const read = (name: string) => readFileSync(new URL(name, root));
const manifest = JSON.parse(read('manifest.json').toString());

describe('legacy UI exports (synthetic user input, no database seeding)', () => {
  for (const version of ['v5', 'v62', 'v71']) {
    it(`${version} validates and preserves onboarding through the legacy UI restore`, () => {
      const before = validateBackupEnvelope(JSON.parse(read(`${version}-onboarding.json`).toString()));
      const after = validateBackupEnvelope(JSON.parse(read(`${version}-onboarding-restored.json`).toString()));
      expect(after.data.guidedStates).toEqual(before.data.guidedStates);
      expect(after.data.profiles).toEqual(before.data.profiles);
      expect(before.data.guidedStates).toHaveLength(1);
      expect(before.data.sessions).toHaveLength(0);
      expect(before.data.plans).toHaveLength(0);
    });
    it(`${version} preserves date plans, instructions, and a weight observation`, () => {
      const data = validateBackupEnvelope(JSON.parse(read(`${version}-plans-weight.json`).toString())).data;
      expect(data.plans).toHaveLength(2);
      expect(data.scheduledWorkouts).toHaveLength(2);
      expect(data.bodyWeights.map(row => row.weightGrams)).toEqual([70200]);
      expect(data.planVersions.every(version => version.days[0].exercises[0].notes === 'Synthetic preserved instruction')).toBe(true);
      expect(data).not.toHaveProperty('coachDevice');
    });
  }
  it('pins every primary export to its source and downloaded bytes', () => {
    expect(manifest.modelCalls).toBe(0);
    expect(manifest.cases).toHaveLength(9);
    for (const sample of manifest.cases) {
      expect(sample.sourceCommit).toMatch(/^[a-f0-9]{40}$/);
      expect(createHash('sha256').update(read(sample.file)).digest('hex')).toBe(sample.sha256);
    }
  });
});
