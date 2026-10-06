import { confirmationFor, goalConfirmationFor, type AiRequest } from '../../src/backend/contracts';
import { EXERCISE_IDS } from '../../src/catalog/exercise-ids';

export async function promptRequest(locale: 'zh' | 'en', operation: 'understand' | 'generate' = 'generate'): Promise<AiRequest> {
  const base = { contractVersion: 1 as const, requestId: '00000000-0000-4000-8000-000000000001',
    operation, goalText: locale === 'zh' ? '提高一般体能' : 'Improve general fitness', locale, restoreGeneration: 0 };
  if (operation === 'understand') return { ...base, operation, sendConfirmation: await confirmationFor(base) };
  const input = { ...base, operation, confirmedGoal: base.goalText, dates: ['2026-10-06'], timeZone: 'Asia/Shanghai', catalogVersion: 1 as const,
    conditions: { experience: 'beginner', availableEquipment: ['none', 'dumbbell'], sessionMinutes: 30,
      exercisePreferences: ['strength', 'cardio', 'bodyweight'] as ('strength' | 'cardio' | 'bodyweight')[],
      trainingLocation: 'home' as const, heightCm: 170, weightGrams: 70000, constraints: 'No additional constraints' } };
  const confirmed = { ...input, goalConfirmation: await goalConfirmationFor(input) };
  return { ...confirmed, sendConfirmation: await confirmationFor(confirmed) };
}

export function fourMetricCandidate() {
  return { days: [{ date: '2026-10-06', exercises: [
    { exerciseId: EXERCISE_IDS.gobletSquat, order: 0, targetSets: [{ metricType: 'reps_load', reps: 8, loadGrams: 4000 }] },
    { exerciseId: EXERCISE_IDS.walking, order: 1, targetSets: [{ metricType: 'duration_distance', durationSeconds: 600, distanceMeters: 700 }] },
    { exerciseId: EXERCISE_IDS.bodyweightSquat, order: 2, targetSets: [{ metricType: 'reps', reps: 8 }] },
    { exerciseId: EXERCISE_IDS.plank, order: 3, targetSets: [{ metricType: 'duration', durationSeconds: 20 }] },
  ] }] };
}
