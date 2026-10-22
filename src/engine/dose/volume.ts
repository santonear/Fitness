import { type Item } from './types';
import { Rules, type Exercise } from '../data';
import { type EnginePlan } from '../contracts';

export function credit(item: Item, r: Rules): Record<string, number> {
  const e = r.byExercise.get(item.exerciseId);
  if (!e) return {};
  const v = r.get('dose.volume.fractional');
  if (
    v.excluded_modalities.includes(e.modality) ||
    v.excluded_patterns.includes(e.primary_pattern) ||
    ['warmup', 'cooldown', 'balance', 'mobility'].includes(item.prescription?.block ?? '')
  )
    return {};
  const map = r.get('dose.muscle_groups').catalog_map;
  const result: Record<string, number> = {};
  const muscles = (e as Exercise & { muscles?: { primary?: string[]; secondary?: string[] } }).muscles;
  for (const [keys, mult] of [
    [e.primaryMuscles ?? muscles?.primary ?? [], v.per_set_credit.primaryMuscles],
    [e.secondaryMuscles ?? muscles?.secondary ?? [], v.per_set_credit.secondaryMuscles],
  ] as [string[], number][]) {
    for (const muscle of keys) {
      const group = map[muscle];
      if (group) result[group] = Math.max(result[group] ?? 0, mult);
    }
  }
  if (!Object.keys(result).length) Object.assign(result, v.pattern_fallback_if_no_muscles[e.primary_pattern] ?? {});
  const rir = item.prescription?.rir[0] ?? r.get('dose.rir.targets').beginner[0];
  const multiplier =
    rir <= 3
      ? v.set_effort_multiplier.rir_0_to_3
      : rir === 4
        ? v.set_effort_multiplier.rir_4
        : v.set_effort_multiplier.rir_5_plus;
  return Object.fromEntries(Object.entries(result).map(([k, n]) => [k, n * item.sets * multiplier]));
}

export function volume(items: Item[], r: Rules) {
  const result: Record<string, number> = {};
  for (const item of items) for (const [k, n] of Object.entries(credit(item, r))) result[k] = (result[k] ?? 0) + n;
  return result;
}

export function weeklyVolume(plan: Pick<EnginePlan, 'templates'>, r: Rules) {
  return volume(
    plan.templates.flatMap(t => t.items),
    r,
  );
}
