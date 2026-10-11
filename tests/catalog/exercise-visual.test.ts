import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
import { EXERCISE_IDS } from '../../src/catalog/exercise-ids';
import { exerciseVisual, exerciseVisualMetadata } from '../../src/catalog/exercise-visual';
import { getExerciseGuide } from '../../src/catalog/exercise-guide';

describe('shared exercise illustrations', () => {
 it('reuses the exact provider movement without changing legacy IDs', () => {
  for (const id of [EXERCISE_IDS.bodyweightSquat, EXERCISE_IDS.plank, EXERCISE_IDS.walking]) {
   expect(exerciseVisual(id)?.src).toMatch(/^\/exercise-media\/repdb\/.*\.webp$/);
   expect(getExerciseGuide(id, 'zh').media?.attribution).toContain('RepDB');
  }
  expect(exerciseVisualMetadata(EXERCISE_IDS.bodyweightSquat)?.slug).toBe('bodyweight-squat');
 });
 it('does not substitute the kettlebell illustration for a dumbbell exercise', () => {
  for (const id of [EXERCISE_IDS.gobletSquat, EXERCISE_IDS.selfResistedRow]) {
   const visual = exerciseVisual(id)!;
   expect(visual.src).toMatch(/^\/media\/.*\.png$/);
   expect(visual.attribution).not.toContain('RepDB');
   expect(existsSync(`public${visual.src}`)).toBe(true);
   expect(getExerciseGuide(id, 'zh').media?.src).toBe(visual.src);
  }
 });
 it('has no active stick SVG fallback or caller supplied URL', () => {
  for (const id of Object.values(EXERCISE_IDS)) expect(exerciseVisual(id)?.src).not.toMatch(/\.svg$/);
  for (const id of ['constructor', '__proto__', 'https://example.test/a.png']) expect(exerciseVisual(id)).toBeUndefined();
 });
});
