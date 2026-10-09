import { describe, expect, it } from 'vitest';
import { adaptDataset, internalId, safeMediaPath, validateReplacements } from '../../tools/catalog/repdb.mjs';
import { writeIfChanged } from '../../tools/catalog/build.mjs';
import { unlink, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Synthetic fixture: never republish the licensed exercise dataset in tests.
const row = { id: 'test-movement', name_en: 'Test movement', category: 'strength', is_bodyweight: false, equipment: 'dumbbell', body_part: 'upper_arms', primary_muscles: ['biceps'], instructions_en: ['Synthetic instruction.'], images: { flat: ['start', 'peak'] } };
const paths = new Set(['images/flat/test-movement-start.webp', 'images/flat/test-movement-peak.webp', 'images/flat/test-movement-main.webp']);
const parse = rows => adaptDataset({ schema_version: 3, exercises: rows }, paths, () => '测试动作').entries;
describe('RepDB boundary', () => {
  it('does not rewrite identical outputs or trigger unnecessary development reloads', async () => {
    const path = join(tmpdir(), `fitness-repdb-${crypto.randomUUID()}.txt`);
    try {
      expect(await writeIfChanged(path, 'first')).toBe(true);
      const before = (await stat(path)).mtimeMs;
      expect(await writeIfChanged(path, 'first')).toBe(false);
      expect((await stat(path)).mtimeMs).toBe(before);
      expect(await writeIfChanged(path, 'second')).toBe(true);
    } finally { await unlink(path); }
  });
  it('maps both poses, provenance and stable IDs independently of names', () => {
    const first = parse([row])[0], renamed = parse([{ ...row, name_en: 'Changed label' }])[0];
    expect(first.id).toBe(renamed.id); expect(first.id).toBe(internalId('test-movement'));
    expect(first.media).toEqual({ start: '/exercise-media/repdb/test-movement-start.webp', peak: '/exercise-media/repdb/test-movement-peak.webp' });
    expect(first.source).toMatchObject({ provider: 'repdb', externalId: row.id, attributionRequired: true, attributionText: 'Exercise data by RepDB' });
    expect(first).toMatchObject({ metricType: 'reps_load', equipment: 'dumbbell', primaryMuscles: ['biceps'] });
  });
  it('supports main-only and undeclared images without inventing paths', () => {
    expect(parse([{ ...row, images: { flat: ['main'] } }])[0].media).toEqual({ main: '/exercise-media/repdb/test-movement-main.webp' });
    expect(parse([{ ...row, images: undefined }])[0].media).toEqual({});
  });
  it('rejects schema drift, duplicate IDs, unknown taxonomy and missing declared images', () => {
    expect(() => adaptDataset({ schema_version: 4, exercises: [row] }, paths, () => '测试')).toThrow();
    expect(() => parse([row, row])).toThrow();
    expect(() => parse([{ ...row, equipment: 'unknown' }])).toThrow();
    expect(() => adaptDataset({ schema_version: 3, exercises: [row] }, new Set(), () => '测试')).toThrow();
    expect(() => parse([{ ...row, instructions_en: [] }])).toThrow();
  });
  it.each(['../private', '/absolute', 'x\\y', 'x?query'])('rejects unsafe source path %s', key => {
    expect(() => safeMediaPath(key, 'start')).toThrow();
  });
  it('rejects unknown poses and cyclic or missing replacements', () => {
    expect(() => safeMediaPath('test', 'premium')).toThrow();
    expect(() => validateReplacements([{ id: 'a', replacementId: 'b' }])).toThrow();
    expect(() => validateReplacements([{ id: 'a', replacementId: 'b' }, { id: 'b', replacementId: 'a' }])).toThrow();
    expect(() => validateReplacements([{ id: 'a', replacementId: 'b' }, { id: 'b' }])).not.toThrow();
  });
});
