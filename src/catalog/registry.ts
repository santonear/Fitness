import registry from './generated/registry.json' with { type: 'json' };
import { EXERCISE_IDS } from './exercise-ids';
import { customCatalog, customExerciseIds } from './custom-exercises';
import { catalogCorrections } from './corrections';

// Provider metadata stays outside training snapshots and user backups.
export const catalogMetadata = new Map(
  [
    ...registry,
    ...customCatalog.map(row => ({
      id: row.id,
      slug: row.slug,
      metricType: row.metricType,
      aliases: [row.name.zh, row.name.en],
      bodyPart: row.bodyPart,
      primaryMuscles: row.primaryMuscles,
      secondaryMuscles: row.secondaryMuscles,
      media: {} as Record<string, string>,
    })),
  ].map(row => [row.id, row]),
);
export const knownExerciseIds = new Set([
  ...Object.values(EXERCISE_IDS),
  ...registry.map(row => row.id),
  ...customExerciseIds,
]);
export function exerciseBodyPart(id: string): string {
  if (id === EXERCISE_IDS.gobletSquat || id === EXERCISE_IDS.bodyweightSquat) return 'legs';
  if (id === EXERCISE_IDS.walking) return 'cardio';
  if (id === EXERCISE_IDS.selfResistedRow) return 'back';
  if (id === EXERCISE_IDS.plank) return 'core';
  const meta = catalogMetadata.get(id);
  // RepDB groups hip-focused work under upper legs; expose its explicit primary muscles.
  if (
    meta?.bodyPart === 'upper-legs' &&
    meta.primaryMuscles.some(muscle => muscle.startsWith('gluteus-')) &&
    meta.primaryMuscles.every(muscle => muscle.startsWith('gluteus-') || muscle === 'abductors')
  )
    return 'glutes';
  return meta?.bodyPart ?? '';
}
export async function loadExerciseDetails(id: string) {
  const custom = customCatalog.find(row => row.id === id);
  if (custom)
    return {
      ...custom,
      steps: custom.steps.en,
      cautions: custom.cautions.en,
      media: {},
      source: { provider: 'fitness-original' },
    };
  const data = await import('./generated/details.json');
  const row = data.entries.find(row => row.id === id);
  if (!row) return undefined;
  const correction = catalogCorrections[row.slug];
  return {
    ...row,
    ...(correction?.equipment ? { equipment: correction.equipment } : {}),
    ...(correction?.name ? { name: correction.name } : {}),
    ...(correction?.steps ? { steps: correction.steps.en } : {}),
  };
}
