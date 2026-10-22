import { type Item } from './types';
import { type EngineProfile, type Pattern } from '../contracts';
import { Rules } from '../data';

/** Continuous aerobic work is one bout; preserve its total time/distance, never user history. */
export function continuousCardioItems(items: Item[], p: EngineProfile, r: Rules): Item[] {
  if (r.get('session.conditioning.slot').default_structure[p.goal] !== 'continuous') return items;
  return items.map(item => {
    const e = r.byExercise.get(item.exerciseId);
    if (
      e?.modality !== 'cardio' ||
      item.prescription?.block !== 'conditioning' ||
      item.prescription.structure !== 'straight' ||
      !Number.isInteger(item.sets) ||
      item.sets <= 1 ||
      !('durationSeconds' in item.target)
    )
      return item;
    return {
      ...item,
      sets: 1,
      target: {
        ...item.target,
        durationSeconds: item.target.durationSeconds * item.sets,
        ...(item.target.metricType === 'duration_distance' && item.target.distanceMeters !== undefined
          ? { distanceMeters: item.target.distanceMeters * item.sets }
          : {}),
      },
    };
  });
}

export function patterns(items: Item[], r: Rules, secondary = false): Set<Pattern> {
  return new Set(
    items
      .filter(i => !['warmup', 'cooldown'].includes(i.prescription?.block ?? ''))
      .flatMap(i => {
        const e = r.byExercise.get(i.exerciseId);
        return e ? [e.primary_pattern, ...(secondary ? e.secondary_patterns : [])] : [];
      }),
  );
}
