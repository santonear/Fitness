import { type Context, type Item } from './types';
import { type RuleValue } from '../data';
import { safety } from '../gates/strength-scoring';
import { prescribedRepRange, effectiveGoalRole } from '../dose';
import { intervalSatisfaction, mean } from './math';

/** Item checks depend only on the item, its actual session role, source goal and bound profile/rules. */
export function goalItemSatisfaction(
  c: Context,
  i: Item,
  name: string,
  goal: RuleValue,
  strengthRole: 'main' | 'accessory' | undefined,
  strengthSafety: ReturnType<typeof safety> | undefined,
): number {
  const timing = c.timing,
    cache =
      timing?.profile === c.p && timing.rules === c.r && timing.baselineItems.has(i) ? timing.goalItems : undefined;
  const entries = cache?.get(i),
    cached = entries?.find(entry => entry.name === name && entry.source === goal && entry.role === strengthRole);
  if (cached) return cached.value;
  const value = (() => {
    const e = c.r.byExercise.get(i.exerciseId);
    if (!e) return 0;
    const role = name === 'strength' ? (strengthRole === 'main' ? 'main_lift' : 'accessory') : undefined,
      params = role ? goal[role] : goal,
      repRange = strengthSafety
        ? prescribedRepRange(e, c.p, c.r, strengthSafety, strengthRole ?? 'accessory')
        : Array.isArray(params.reps)
          ? params.reps
          : [params.reps.min, params.reps.max],
      rirRange = Array.isArray(params.rir) ? params.rir : [params.rir.min, params.rir.max],
      checks = [i.prescription ? intervalSatisfaction(i.prescription.rir[0], rirRange[0], rirRange[1]) : 0];
    if (name === 'strength') checks.push(Number(effectiveGoalRole(i, c.p, c.r) === strengthRole));
    if ('reps' in i.target) checks.push(intervalSatisfaction(i.target.reps, repRange[0], repRange[1]));
    if (name === 'muscle' && i.prescription?.rir[0] === 0)
      checks.push(
        Number(
          i.sets === 1 &&
            (e.nsca_class === 'isolation' || e.equipment_required.some(k => k.endsWith('-machine') || k === 'cable')),
        ),
      );
    if (name === 'mobility' && e.modality === 'strength' && 'reps' in i.target) {
      const t = i.prescription?.tempo;
      checks.push(
        Number(
          !!t &&
            t.eccentricSeconds === goal.eccentric_s &&
            t.concentricSeconds === goal.concentric_s &&
            t.pauseSeconds === goal.pause_s &&
            (i.prescription?.secondsPerRep ?? 0) >= Math.max(goal.rep_duration_min_s, e.time.s_per_rep ?? 0),
        ),
      );
    }
    return mean(checks);
  })();
  if (cache) {
    const entry = { name, source: goal, role: strengthRole, value };
    if (entries) entries.push(entry);
    else cache.set(i, [entry]);
  }
  return value;
}
