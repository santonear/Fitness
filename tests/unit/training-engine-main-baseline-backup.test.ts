import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
import { validateBackupEnvelope } from '../../src/application/backup';
it('keeps the actual pre-engine main UI download pinned to its source and complete training/body facts', () => {
  const root = new URL('../fixtures/legacy-backups/', import.meta.url),
    bytes = readFileSync(new URL('v8-main-pre-engine.json', root)),
    manifest = JSON.parse(readFileSync(new URL('v8-main-pre-engine.manifest.json', root), 'utf8')),
    raw = JSON.parse(bytes.toString()),
    before = structuredClone(raw),
    backup = validateBackupEnvelope(raw);
  expect(manifest.sourceCommit).toBe('0165768d37bcee81492c62f8b9ed0a573dd11521');
  expect(createHash('sha256').update(bytes).digest('hex')).toBe(manifest.sha256);
  expect(bytes.length).toBe(manifest.bytes);
  expect(backup.data.v8!.workouts).toHaveLength(1);
  expect(backup.data.v8!.workouts[0].sets).toHaveLength(1);
  expect(backup.data.v8!.workouts[0].status).toBe('partial');
  expect(backup.data.v8!.plans.length).toBeGreaterThan(0);
  expect(backup.data.bodyWeights.map(row => row.weightGrams).sort()).toEqual([70000, 71000]);
  expect(raw).toEqual(before);
});
