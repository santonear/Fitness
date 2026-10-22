import { exercises } from '../../../../catalog/exercises';
import { EQUIPMENT, equipmentLabel } from '../../../../catalog/taxonomy';
import type { WorkoutRecord } from '../../../../domain/v8/contracts';

export const places = ['home', 'gym', 'outdoor'] as const;
export const goals = ['muscle', 'fat_loss', 'fitness', 'mobility', 'rehab'] as const;
export const primaryEquipment = [
  'none',
  'yoga-mat',
  'dumbbell',
  'kettlebell',
  'resistance-band',
  'barbell',
  'pull-up-bar',
  'gym-machine',
];
export const machineEquipment = EQUIPMENT.filter(key =>
  /machine|cable|smith|leg-press|hack-squat|leg-curl|leg-extension|pec-deck|rower|treadmill|elliptical|bike|stair|ski-erg/.test(
    key,
  ),
);
export const bodyParts = ['full-body', 'legs', 'glutes', 'chest', 'back', 'shoulders', 'arms', 'core', 'cardio'];
export function toggleSelection(values: string[], id: string): string[] {
  return values.includes(id) ? values.filter(value => value !== id) : [...values, id];
}
/** Explicit home selection adds the basic equipment defaults; an empty answer stays unfiltered. */
export function initialFilters(text: string) {
  const selectedPlaces = places.filter((place, index) =>
    [/在家|家里|家中|居家|\bhome\b/i, /健身房|\bgym\b/i, /户外|\boutdoor\b/i][index].test(text),
  );
  const equipment = [...new Set([...EQUIPMENT, 'yoga-mat'])].filter(key => {
    if (key === 'none') return /无器械|无需器械|徒手|\bnone\b|bodyweight|no equipment/i.test(text);
    if (key === 'yoga-mat') return /瑜伽垫|yoga.mat/i.test(text);
    return (
      text.toLowerCase().includes(key.replaceAll('-', ' ')) ||
      text.toLowerCase().includes(key) ||
      text.includes(equipmentLabel(key, 'zh'))
    );
  });
  return {
    places: [...selectedPlaces],
    equipment: selectedPlaces.includes('home') ? [...new Set([...equipment, 'none', 'yoga-mat'])] : equipment,
  };
}
export function recentExerciseIds(workouts: WorkoutRecord[]): string[] {
  const known = new Set(exercises.map(exercise => exercise.id));
  return [
    ...new Set(
      [...workouts]
        .filter(workout => ['complete', 'partial'].includes(workout.status))
        .sort((a, b) => b.startedAt.localeCompare(a.startedAt))
        .flatMap(workout => workout.sets.map(set => set.exerciseId)),
    ),
  ]
    .filter(id => known.has(id))
    .slice(0, 12);
}
