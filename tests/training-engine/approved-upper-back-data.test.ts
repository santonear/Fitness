import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import index from '../../src/engine/generated/exercise-index.json';
import custom from '../../src/catalog/custom-exercises.json';
import { getExerciseGuide } from '../../src/catalog/exercise-guide';
import { getEligibleExercises } from '../../src/engine';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
const compilerPath = '../../tools/training-engine/compile-annotations';
const { validateAnnotations, validateMobilityAnnotations } = await import(compilerPath);
const slug = 'custom-standing-upper-back-stretch',
  source = 'https://myhealth.alberta.ca/health/AfterCareInformation/pages/conditions.aspx?hwid=zp4447',
  annotations = JSON.parse(readFileSync('data/training-engine/custom-annotations.json', 'utf8')),
  overlays = JSON.parse(readFileSync('data/training-engine/mobility-annotations.json', 'utf8')),
  details = JSON.parse(readFileSync('src/catalog/generated/details.json', 'utf8')).entries;
it('appends one original source-backed action while preserving every old stable ID and its order', () => {
  expect(index.counts).toEqual({
    repdb: 637,
    native: 3,
    custom: 60,
    total: 700,
  });
  expect(
    createHash('sha256')
      .update(JSON.stringify(index.exercises.slice(0, -3).map(e => e.id)))
      .digest('hex'),
    // The previous order minus the 11 merged duplicates (Bo 2026-10-31), which moved to hiddenExercises.
  ).toBe('d81e8678e4fbacd53fe26bac4578e4e8a1d07e5fcd16af6ebb6a7a806a56cb1c');
  expect(index.exercises.at(-3)?.slug).toBe(slug);
  expect(new Set(index.exercises.map(e => e.id)).size).toBe(670);
  expect(index.hiddenExercises).toHaveLength(11);
});
it('retains the approved standing no-gear static back variant and honest nonzero loads', () => {
  const e = index.exercises.find(e => e.slug === slug)!;
  expect(e).toMatchObject({
    primary_pattern: 'mobility',
    modality: 'mobility',
    mobility_type: 'static',
    stretch_targets: ['back'],
    stretch_hold_s: [15, 30],
    position: ['standing'],
    equipment_required: ['none'],
    space: 'mat',
    use: ['cooldown'],
    requires_floor_transition: false,
    time: { per_side: false },
    joint_load: { knee: 0, back: 1, shoulder: 1, wrist: 0, hip: 0, ankle: 0 },
    primaryMuscles: ['rhomboids'],
  });
  expect(e.flags).not.toContain('overhead_load');
  const a = annotations.find((a: { slug: string }) => a.slug === slug);
  expect(a.note).toContain(source);
  expect(a.default_dose.beginner).toMatchObject({
    sets: [2, 4],
    seconds: [15, 30],
  });
  const entry = custom.find(e => e.slug === slug)!;
  expect(entry).toMatchObject({
    contentSource: {
      url: source,
      section: 'Lower neck and upper back (rhomboid) stretch',
    },
  });
  for (const locale of ['zh', 'en'] as const) {
    const guide = getExerciseGuide(e.id, locale);
    expect(guide.steps.length).toBeGreaterThan(0);
    expect(guide.cautions.length).toBeGreaterThan(0);
  }
});
it('pins custom English paraphrase steps to the custom source path and rejects evidence drift or a wrong source', () => {
  const row = overlays.find((row: { slug: string }) => row.slug === slug),
    a = validateAnnotations(annotations);
  expect(row.sourcePath).toBe('src/catalog/custom-exercises.json');
  expect(row.stepIndexes).toEqual([0, 1, 2]);
  expect(validateMobilityAnnotations([row], details, a, ['back'], custom)).toEqual([row]);
  const changed = structuredClone(custom);
  changed.find(e => e.slug === slug)!.steps.en[1] += ' Changed.';
  expect(() => validateMobilityAnnotations([row], details, a, ['back'], changed)).toThrow('Mobility source changed');
  expect(() =>
    validateMobilityAnnotations(
      [{ ...row, sourcePath: 'src/catalog/generated/details.json' }],
      details,
      a,
      ['back'],
      custom,
    ),
  ).toThrow('Unknown mobility annotation source');
});
it('accepts only ordered positive integer source hold ranges without inventing ranges on other actions', () => {
  const a = annotations.find((a: { slug: string }) => a.slug === slug);
  for (const stretch_hold_s of [
    [0, 30],
    [-1, 30],
    [30, 15],
    [15.5, 30],
  ])
    expect(() => validateAnnotations([{ ...a, stretch_hold_s }])).toThrow();
  expect(validateAnnotations([{ ...a, stretch_hold_s: [15, 30] }])[0].stretch_hold_s).toEqual([15, 30]);
  expect(index.exercises.filter(e => 'stretch_hold_s' in e).map(e => e.slug)).toEqual([slug]);
});
it('adds only evidence-backed dynamic types without changing the original body regions or inferring static targets', () => {
  for (const [name, bodyPart, indices] of [
    ['pilates-roll-down', 'back', [1, 3, 4]],
    ['torso-twists', 'core', [1, 2, 3, 4]],
  ] as const) {
    expect(index.exercises.find(e => e.slug === name)).toMatchObject({
      mobility_type: 'dynamic',
      bodyPart,
    });
    expect(index.exercises.find(e => e.slug === name)).not.toHaveProperty('stretch_targets');
    expect(overlays.find((e: { slug: string }) => e.slug === name)).toMatchObject({
      sourcePath: 'src/catalog/generated/details.json',
      stepIndexes: [...indices],
    });
  }
});
it('admits only the two approved standing stretches in mat space while neighboring original space requirements still apply', () => {
  const p = baseProfile({
      equipment: ['none', 'flat-bench', 'resistance-band'],
      constraints: { quiet: false, noJump: false, space: 'mat' },
    }),
    mat = new Set(getEligibleExercises(p).map(e => e.exerciseId)),
    bySlug = (slug: string) => index.exercises.find(e => e.slug === slug)!;
  for (const slug of ['cross-body-shoulder-stretch', 'doorway-chest-stretch']) {
    expect(bySlug(slug)).toMatchObject({
      space: 'mat',
      equipment_required: ['none'],
      position: ['standing'],
      joint_load: { shoulder: 1 },
    });
    expect(mat.has(bySlug(slug).id)).toBe(true);
  }
  const small = new Set(
    getEligibleExercises({
      ...p,
      constraints: { ...p.constraints, space: 'small' },
    }).map(e => e.exerciseId),
  );
  for (const slug of ['bench-chest-stretch', 'banded-chest-stretch']) {
    expect(bySlug(slug).space).toBe('small');
    expect(mat.has(bySlug(slug).id)).toBe(false);
    expect(small.has(bySlug(slug).id)).toBe(true);
  }
  expect(bySlug('walking').space).toBe('large');
  expect(mat.has(bySlug('walking').id)).toBe(false);
  expect(small.has(bySlug('walking').id)).toBe(false);
});
