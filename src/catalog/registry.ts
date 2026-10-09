import registry from './generated/registry.json' with { type: 'json' };
import { EXERCISE_IDS } from './exercise-ids';

// Provider metadata stays outside training snapshots and user backups.
export const catalogMetadata = new Map(registry.map(row => [row.id, row]));
export const knownExerciseIds = new Set([...Object.values(EXERCISE_IDS), ...registry.map(row => row.id)]);
export function exerciseBodyPart(id: string): string {
  if (id === EXERCISE_IDS.gobletSquat || id === EXERCISE_IDS.bodyweightSquat) return 'legs';
  if (id === EXERCISE_IDS.walking) return 'cardio';
  if (id === EXERCISE_IDS.plank) return 'core';
  return catalogMetadata.get(id)?.bodyPart ?? '';
}
export async function loadExerciseDetails(id: string) {
  const data = await import('./generated/details.json');
  return data.entries.find(row => row.id === id);
}
