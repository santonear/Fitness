import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { createElement } from 'react';
import { exercises, EXERCISE_IDS } from '../../src/catalog/exercises';
import { catalogMetadata, knownExerciseIds } from '../../src/catalog/registry';
import { selectAiExercises } from '../../src/catalog/ai-catalog';
import { exerciseIdSchema, exerciseSnapshotSchema } from '../../src/domain/schemas';
import { searchExercises } from '../../src/catalog/catalog-service';
import { equipmentLabel, EQUIPMENT } from '../../src/catalog/taxonomy';
import { RepDBAttribution } from '../../src/ui/components/RepDBAttribution';
import { CatalogImage } from '../../src/ui/components/RepDBMedia';

it('loads all 637 source exercises and retains the two distinct legacy squat variants', () => {
  expect(catalogMetadata.size).toBe(637); expect(exercises).toHaveLength(639);
  expect(knownExerciseIds.size).toBe(639);
  expect(exercises.slice(0, 4).map(x => x.id)).toEqual(Object.values(EXERCISE_IDS));
  expect(exercises.find(x => x.id === EXERCISE_IDS.gobletSquat)).toMatchObject({ equipment: 'dumbbell', metricType: 'reps_load' });
  const squat = [...catalogMetadata.values()].find(x => x.slug === 'squat')!;
  expect(squat.id).not.toBe(EXERCISE_IDS.bodyweightSquat);
  expect(exercises.find(x => x.id === squat.id)?.equipment).toBe('barbell');
});
it('keeps names bilingual, equipment labels complete and all media local', () => {
  expect(EQUIPMENT.every(x => Boolean(equipmentLabel(x, 'zh')))).toBe(true);
  for (const row of exercises) expect(row.name.zh).toMatch(/[\u4e00-\u9fff]/);
  const paths = [...catalogMetadata.values()].flatMap(row => Object.values(row.media));
  expect(paths).toHaveLength(1126);
  expect(paths.every(path => path?.startsWith('/exercise-media/repdb/') && !path.includes('premium'))).toBe(true);
});
it('searches Chinese and original aliases without changing IDs', () => {
  expect(searchExercises('阿诺德', 'zh', { equipment: 'dumbbell' }).length).toBeGreaterThan(0);
  expect(searchExercises('Arnold', 'en', {}).map(x => x.id)).toEqual(searchExercises('阿诺德', 'zh', {}).map(x => x.id));
});
it('accepts catalog IDs but rejects invented ones and prevents provenance entering snapshots', () => {
  expect(exerciseIdSchema.safeParse(exercises[4].id).success).toBe(true);
  expect(exerciseIdSchema.safeParse('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa').success).toBe(false);
  expect(exerciseSnapshotSchema.shape).not.toHaveProperty('source');
  expect(exerciseSnapshotSchema.shape).not.toHaveProperty('media');
});
it('bounds the AI catalog and makes every exercise selectable by exact name', () => {
  for (const exercise of exercises) {
    const choices = selectAiExercises(exercise.name.en, { equipment: exercise.equipment });
    expect(choices.length).toBeLessThanOrEqual(64);
    expect(choices.some(x => x.id === exercise.id), exercise.name.en).toBe(true);
  }
});
it('renders the exact linked attribution and a missing-image fallback', () => {
  const html = renderToStaticMarkup(createElement(RepDBAttribution));
  expect(html).toContain('Exercise data by '); expect(html).toContain('href="https://repdb.co/"');
  expect(html).toContain('>RepDB</a>');
  expect(renderToStaticMarkup(createElement(CatalogImage, { alt: 'Test', locale: 'en' }))).toContain('Image unavailable');
});
