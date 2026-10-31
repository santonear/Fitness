import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { expect, it } from 'vitest';
const compilerPath = '../../tools/training-engine/compile-annotations';
const { validateMobilityAnnotations, validateAnnotations } = await import(compilerPath);
import { Rules } from '../../src/engine/data';
import runtime from '../../src/engine/generated/exercise-index.json';
const rows = JSON.parse(readFileSync('data/training-engine/mobility-annotations.json', 'utf8')) as {
  slug: string;
  mobility_type: 'dynamic' | 'static';
  stretch_targets?: string[];
  sourcePath: string;
  stepIndexes: number[];
  stepsSha256: string;
}[];
const details = JSON.parse(readFileSync('src/catalog/generated/details.json', 'utf8')).entries as {
  slug: string;
  steps: string[];
}[];
const custom = JSON.parse(readFileSync('src/catalog/custom-exercises.json', 'utf8')) as {
  slug: string;
  steps: { en: string[] };
}[];
it('pins every mobility type to its exact local instruction evidence and retains unannotated types as unknown', () => {
  expect(rows).toHaveLength(20);
  expect(new Set(rows.map(row => row.slug)).size).toBe(rows.length);
  for (const row of rows) {
    expect(['src/catalog/generated/details.json', 'src/catalog/custom-exercises.json']).toContain(row.sourcePath);
    const source =
      row.sourcePath === 'src/catalog/custom-exercises.json'
        ? custom.map(item => ({ slug: item.slug, steps: item.steps.en })).find(item => item.slug === row.slug)
        : details.find(item => item.slug === row.slug);
    expect(source).toBeDefined();
    expect(createHash('sha256').update(JSON.stringify(source!.steps)).digest('hex')).toBe(row.stepsSha256);
    expect(row.stepIndexes.length).toBeGreaterThan(0);
    for (const n of row.stepIndexes) {
      expect(Number.isInteger(n) && n >= 0).toBe(true);
      expect(source!.steps[n]).toBeTruthy();
    }
    const exercise = [...runtime.exercises, ...runtime.hiddenExercises].find(item => item.slug === row.slug);
    expect(exercise?.modality).toBe('mobility');
    expect((exercise as { mobility_type?: string })?.mobility_type).toBe(row.mobility_type);
  }
  for (const exercise of runtime.exercises.filter(
    item => item.modality === 'mobility' && !rows.some(row => row.slug === item.slug),
  ))
    expect(exercise).not.toHaveProperty('mobility_type');
});

it('validates the twelve explicit source-pinned static target lists against the actual source group enum', () => {
  const annotations = validateAnnotations([
      ...JSON.parse(readFileSync('data/training-engine/annotations.json', 'utf8')),
      ...JSON.parse(readFileSync('data/training-engine/custom-annotations.json', 'utf8')),
    ]),
    groups = new Rules().get('dose.muscle_groups').target_groups as string[];
  expect(rows.filter(row => row.stretch_targets)).toHaveLength(12);
  expect(validateMobilityAnnotations(rows, details, annotations, groups, custom)).toEqual(rows);
  for (const row of rows.filter(row => row.stretch_targets)) {
    expect(row.mobility_type).toBe('static');
    for (const target of row.stretch_targets!) expect(groups).toContain(target);
    expect(
      (runtime.exercises.find(e => e.slug === row.slug) as { stretch_targets?: string[] }).stretch_targets,
    ).toEqual(row.stretch_targets);
  }
  const staticRow = rows.find(row => row.stretch_targets)!;
  expect(() =>
    validateMobilityAnnotations(
      [{ ...staticRow, stretch_targets: ['__unregistered__'] }],
      details,
      annotations,
      groups,
    ),
  ).toThrow('Invalid explicit stretch targets');
  const dynamic = rows.find(row => row.mobility_type === 'dynamic')!;
  expect(() =>
    validateMobilityAnnotations([{ ...dynamic, stretch_targets: [groups[0]] }], details, annotations, groups),
  ).toThrow('Invalid explicit stretch targets');
  expect(() =>
    validateMobilityAnnotations(
      [{ ...staticRow, stretch_targets: [groups[0], groups[0]] }],
      details,
      annotations,
      groups,
    ),
  ).toThrow('Invalid explicit stretch targets');
  for (const e of runtime.exercises.filter(
    e => e.modality === 'mobility' && !rows.find(row => row.slug === e.slug)?.stretch_targets,
  ))
    expect(e).not.toHaveProperty('stretch_targets');
});
it('rejects changed instruction evidence rather than silently keeping reviewed mobility targets', () => {
  const annotations = validateAnnotations([
      ...JSON.parse(readFileSync('data/training-engine/annotations.json', 'utf8')),
      ...JSON.parse(readFileSync('data/training-engine/custom-annotations.json', 'utf8')),
    ]),
    groups = new Rules().get('dose.muscle_groups').target_groups as string[],
    row = rows.find(r => r.stretch_targets)!,
    changed = structuredClone(details);
  changed.find(r => r.slug === row.slug)!.steps.push('unreviewed instruction change');
  expect(() => validateMobilityAnnotations([row], changed, annotations, groups)).toThrow(
    'Mobility source changed; re-review required',
  );
});
