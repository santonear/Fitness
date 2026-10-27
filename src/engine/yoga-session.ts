import type { EnginePrescription, EngineProfile } from './contracts';
import type { Rules } from './data';

/** Source positions of the yoga day template (week.day.yoga) all start with this prefix. */
export const YOGA_POSITION_PREFIX = 'yoga_';

/** A yoga session is built by its own sequence; generic refill, trimming and swaps leave it alone. */
export function isYogaSession(template: { items: { prescription?: Pick<EnginePrescription, 'sourcePosition'> }[] }) {
  return (
    template.items.length > 0 &&
    template.items.every(item => item.prescription?.sourcePosition?.startsWith(YOGA_POSITION_PREFIX))
  );
}

/** Yoga-only poses join the exercise pool for the yoga goal only; every other goal keeps its pool. */
export function engineExercises(r: Rules, goal: EngineProfile['goal']) {
  return goal === 'yoga' ? [...r.data.exercises, ...(r.data.yogaExercises ?? [])] : r.data.exercises;
}
