import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import raw from '../../src/engine/generated/rules.json';
import runtime from '../../src/engine/generated/rules-runtime.json';
import index from '../../src/engine/generated/exercise-index.json';
import { exercises, EXERCISE_IDS } from '../../src/catalog/exercises';
import { customCatalog } from '../../src/catalog/custom-exercises';
import { getExerciseGuide } from '../../src/catalog/exercise-guide';
import { gzipSync } from 'node:zlib';

function leaves(node: unknown, out: Set<string> = new Set()): Set<string> {
  if (typeof node === 'string') out.add(node);
  else if (node && typeof node === 'object') for (const value of Object.values(node)) leaves(value, out);
  return out;
}
describe('compiled provenance and actual catalog coverage', () => {
  it('keeps the combined runtime data payload below 160000 gzip bytes', () => {
    expect(gzipSync(JSON.stringify({ rules: runtime, index })).byteLength).toBeLessThanOrEqual(160000);
  });
  it('preserves every machine behavior and exact copy while slimming runtime metadata', () => {
    expect(runtime.rulesVersion).toBe(raw.rulesVersion);
    expect(runtime.copy).toEqual(raw.copy);
    expect(runtime.rules).toEqual(
      raw.rules.map(
        ({
          note: _,
          evidence: __,
          sources: ___,
          unverified: ____,
          professional_review: _____,
          zh: ______,
          en: _______,
          ...rule
        }) => rule,
      ),
    );
    expect(createHash('sha256').update(JSON.stringify(raw.rules)).digest('hex')).toBe(raw.rulesVersion);
    const rules = new Map(raw.rules.map(rule => [rule.id, rule]));
    for (const copy of Object.values(raw.copy)) {
      const source = rules.get(copy.sourceRuleId);
      expect(source).toBeDefined();
      const strings = leaves(source);
      expect(strings.has(copy.zh), copy.sourceRuleId).toBe(true);
      expect(strings.has(copy.en), copy.sourceRuleId).toBe(true);
    }
  });
  it('joins every runtime exercise exactly once while retaining 637 provider rows and native IDs', () => {
    expect(index.counts.repdb).toBe(637);
    expect(index.counts.native).toBe(3);
    expect(index.counts.custom).toBe(customCatalog.length);
    const runtime = [...index.exercises, ...index.yogaExercises];
    expect(new Set(runtime.map(row => row.id)).size).toBe(exercises.length);
    expect(runtime.map(row => row.id).sort()).toEqual(exercises.map(row => row.id).sort());
    expect(exercises.slice(0, 5).map(row => row.id)).toEqual(Object.values(EXERCISE_IDS));
  });
  it('describes the real native dumbbell goblet squat rather than the supplier kettlebell variant', () => {
    expect(exercises.find(row => row.id === EXERCISE_IDS.gobletSquat)?.equipment).toBe('dumbbell');
    expect(index.exercises.find(row => row.id === EXERCISE_IDS.gobletSquat)?.equipment_required).toEqual(['dumbbell']);
  });
  it('marks seated floor drills as floor transitions but keeps the standing wall plank off the floor', () => {
    expect(index.exercises.find(row => row.slug === 'custom-wall-plank')).toMatchObject({
      requires_floor_transition: false,
    });
    for (const slug of [
      'custom-seated-self-overhead-press',
      'custom-seated-self-resisted-leg-curl',
      'custom-band-self-anchored-row',
    ])
      expect(
        index.exercises.find(row => row.slug === slug),
        slug,
      ).toMatchObject({ requires_floor_transition: true });
  });
  it('gives the first custom exercise a guide with steps and cautions in both languages', () => {
    const exercise = customCatalog[0];
    for (const locale of ['zh', 'en'] as const) {
      const guide = getExerciseGuide(exercise.id, locale);
      expect(guide.steps.length).toBeGreaterThan(0);
      expect(guide.cautions.length).toBeGreaterThan(0);
    }
  });
});
