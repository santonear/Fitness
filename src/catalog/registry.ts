import registry from './generated/registry.json' with { type: 'json' };
import { EXERCISE_IDS } from './exercise-ids';

// Provider metadata stays outside training snapshots and user backups.
export const catalogMetadata = new Map(registry.map(row => [row.id, row]));
export const knownExerciseIds = new Set([...Object.values(EXERCISE_IDS), ...registry.map(row => row.id)]);
export function exerciseBodyPart(id: string): string {
  if (id === EXERCISE_IDS.gobletSquat || id === EXERCISE_IDS.bodyweightSquat) return 'legs';
  if (id === EXERCISE_IDS.walking) return 'cardio';
  if (id === EXERCISE_IDS.selfResistedRow) return 'back';
  if (id === EXERCISE_IDS.plank) return 'core';
  const meta = catalogMetadata.get(id);
  // RepDB groups hip-focused work under upper legs; expose its explicit primary muscles.
  if (meta?.bodyPart === 'upper-legs' && meta.primaryMuscles.some(muscle => muscle.startsWith('gluteus-')) && meta.primaryMuscles.every(muscle => muscle.startsWith('gluteus-') || muscle === 'abductors')) return 'glutes';
  return meta?.bodyPart ?? '';
}
export async function loadExerciseDetails(id: string) {
  const data = await import('./generated/details.json');
  return data.entries.find(row => row.id === id);
}
