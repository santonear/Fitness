import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { validateBackupEnvelope } from '../../src/application/backup';

const root = new URL('../fixtures/legacy-backups/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('coach-manifest.json', root), 'utf8'));
const bytes = readFileSync(new URL(manifest.file, root));
describe('V7.1 fixed-mock coach plan saved through legacy UI', () => {
  it('validates the exported confirmed plan and original instructions', () => {
    const { data } = validateBackupEnvelope(JSON.parse(bytes.toString()));
    expect(data.plans).toHaveLength(1);
    expect(data.plans[0]).toMatchObject({ name: 'Reviewed synthetic coach plan', source: 'ai' });
    expect(data.planVersions[0].days[0].exercises[0]).toMatchObject({ notes: 'Synthetic coach instruction', targetSets: [{ metricType: 'reps', reps: 8 }], setTimings: [{ durationSeconds: 40, restSeconds: 30 }] });
    expect(data.scheduledWorkouts).toHaveLength(1);
    expect(data.sessions).toHaveLength(0);
  });
  it('discloses simulation and pins source and exact download bytes', () => {
    expect(manifest.sourceCommit).toMatch(/^9d2a212[a-f0-9]{33}$/);
    expect(manifest.realModelCalls).toBe(0);
    expect(manifest.mockOperations).toEqual(['understand', 'generate']);
    expect(manifest.mockSource).toBe('generate-coach.mjs');
    expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.sha256);
  });
});
