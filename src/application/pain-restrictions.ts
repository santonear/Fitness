import type { WorkoutRecord } from '../domain/v8/contracts';
import type { EngineProfile } from '../engine/contracts';
import { exerciseById } from '../engine/data';
import { historyPainState, type PainFollowupRestriction } from './engine-profile';
import { activePainReplacement } from './training-pain';
/** The same temporary movement-pattern exclusion applies to planned and manual sessions. */
export function painExcludedItemIndexes(
  record: WorkoutRecord,
  history: WorkoutRecord[],
  stored?: EngineProfile['painState'],
  followups: readonly PainFollowupRestriction[] = [],
) {
  const patterns = new Set(
    (historyPainState(history, stored, followups) ?? [])
      .filter(row => row.remainingSessions > 0)
      .map(row => row.pattern),
  );
  const excluded = new Set(record.painActions?.flatMap(action => action.excludedItemIndexes ?? []));
  for (const item of record.plannedExercises ?? []) {
    const manual = record.substitutions?.filter(row => row.itemIndex === item.itemIndex).at(-1);
    const id = activePainReplacement(record, item.itemIndex)?.exerciseId ?? manual?.toExerciseId ?? item.exerciseId;
    const pattern = exerciseById.get(id)?.primary_pattern;
    if (pattern && patterns.has(pattern)) excluded.add(item.itemIndex);
  }
  return [...excluded];
}
