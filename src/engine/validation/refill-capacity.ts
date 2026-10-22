import type { EnginePlan, EngineProfile } from '../contracts';
import type { Rules } from '../data';
import { stretchHoldRange } from '../data';
import { checkHard } from '../hard-checks';
import { runGates } from '../gates';
import { prescribe } from '../dose';
import { independentElapsedSeconds } from './cardio-duration';
import { cooldownCapSeconds } from '../progression/legacy-cooldown';
import { safetyBlockMinimums } from '../progression/legacy-blocks';
import { durationTier, timingRow } from '../progression/legacy-target';
type Template = EnginePlan['templates'][number];
/** Search the independently filtered complete pool, not producer trace/quality or refill decisions.
 * Full hard checks verify each concrete witness; elapsed arithmetic is independently recomputed. */
export function independentRefillWitness(
  plan: EnginePlan,
  t: Template,
  p: EngineProfile,
  r: Rules,
  possibleIds: readonly string[],
): string | undefined {
  const g = runGates(p, r),
    target = (t.targetMinutes ?? p.sessionMinutes) * 60,
    before = independentElapsedSeconds(t.items, r),
    source = r.get('duration.cardio.cap');
  const test = (next: Template) => {
    const after = independentElapsedSeconds(next.items, r);
    const budget = source.refill.mobility_budget;
    const mobility = next.items.filter(item => {
      const exercise = r.byExercise.get(item.exerciseId);
      return (
        exercise &&
        budget.aggregate_modalities.includes(exercise.modality) &&
        !budget.exclude_patterns.includes(exercise.primary_pattern) &&
        !exercise.flags.some(flag => budget.exclude_flags.includes(flag))
      );
    });
    if (independentElapsedSeconds(mobility, r) > Math.max(budget.minimum_seconds, after * budget.session_fraction))
      return false;
    if (after <= before || after > target * 1.2 || Math.abs(after - target) >= Math.abs(before - target)) return false;
    const candidate = {
      ...plan,
      templates: plan.templates.map(row => (row.id === t.id ? next : row)),
    };
    return !checkHard(candidate, p, g, r, true).some(issue => issue.severity === 'error');
  };
  const timedCap = (e: (typeof r.data.exercises)[number]) => {
    let max =
      (source.explicit_low_intensity_slugs ?? []).includes(e.slug) ||
      (e.flags.includes(source.low_intensity.required_flag) && e.impact === source.low_intensity.impact)
        ? source.low_intensity.max_work_seconds
        : source.other_max_work_seconds;
    for (const row of source.specialized_caps ?? []) if (!row.when) max = Math.min(max, row.max_work_seconds);
    return max;
  };
  for (const [index, item] of t.items.entries()) {
    const e = r.byExercise.get(item.exerciseId);
    if (!e) continue;
    const boundary = ['warmup', 'cooldown'].includes(item.prescription?.block ?? '');
    const max =
      e.mobility_type === 'static'
        ? r.get('dose.stretch').reps_per_muscle[1]
        : ['main', 'accessory'].includes(item.prescription?.block ?? '') &&
            ['strength', 'isometric', 'power'].includes(e.modality)
          ? r.get('duration.fit.bounds').sets_per_exercise_max[p.level]
          : e.default_dose[p.level]?.sets?.[1];
    const fitsBlock = (next: Template) => {
      if (!boundary) return true;
      const block = item.prescription!.block,
        row = timingRow(durationTier(t.targetMinutes ?? p.sessionMinutes, p, r), r),
        safe = safetyBlockMinimums(t, p, r);
      return (
        independentElapsedSeconds(
          next.items.filter(i => i.prescription?.block === block),
          r,
        ) <= (block === 'cooldown' ? cooldownCapSeconds(t, p, r) : Math.max(row.warmup * 60, safe.warmupSeconds))
      );
    };
    if (max && item.sets < max) {
      const next = structuredClone(t);
      next.items[index].sets++;
      if (fitsBlock(next) && test(next)) return 'existing_sets:' + item.prescription?.block;
    }
    if ('durationSeconds' in item.target) {
      const range =
        e.mobility_type === 'static'
          ? stretchHoldRange(e, r, g.restrictions.population)
          : e.default_dose[p.level]?.seconds;
      const side = item.prescription?.perSide || e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1;
      const maxSeconds = e.modality === 'cardio' ? timedCap(e) / (item.sets * side) : range?.[1];
      if (maxSeconds && item.target.durationSeconds < maxSeconds) {
        const next = structuredClone(t),
          row = next.items[index];
        if ('durationSeconds' in row.target)
          row.target.durationSeconds = Math.min(
            maxSeconds,
            row.target.durationSeconds + Math.max(1, Math.floor((target - before) / (item.sets * side))),
          );
        if (fitsBlock(next) && test(next)) return 'existing_duration:' + item.prescription?.block;
      }
    }
  }
  const resistanceDay = t.items.some(i => ['main', 'accessory'].includes(i.prescription?.block ?? ''));
  const possible = new Set(possibleIds),
    used = new Set(t.items.map(i => i.exerciseId)),
    patterns = new Set(t.items.map(i => r.byExercise.get(i.exerciseId)?.primary_pattern));
  for (const e of r.data.exercises) {
    if (!possible.has(e.id) || used.has(e.id)) continue;
    const resistance = ['strength', 'isometric', 'power'].includes(e.modality),
      low =
        e.modality === 'mobility' ||
        e.primary_pattern === 'balance' ||
        e.flags.includes('breathing') ||
        (e.modality === 'cardio' &&
          ((source.explicit_low_intensity_slugs ?? []).includes(e.slug) ||
            (e.flags.includes(source.low_intensity.required_flag) && e.impact === source.low_intensity.impact)));
    if (!low && (!resistanceDay || !resistance || patterns.has(e.primary_pattern))) continue;
    const role = low
      ? e.modality === 'cardio'
        ? 'conditioning'
        : e.primary_pattern === 'balance'
          ? 'balance'
          : 'mobility'
      : 'accessory';
    // Dose defaults are shared source arithmetic; witness selection and acceptance are not producer conclusions.
    const item = prescribe(e, p, r, g.restrictions, role, 1);
    if (e.modality === 'cardio' && 'durationSeconds' in item.target) {
      item.target.durationSeconds = Math.min(item.target.durationSeconds, timedCap(e));
      const light = Math.min(r.get('aerobic.intensity.rpe_scale').light_max, g.restrictions.maxRpe);
      item.prescription!.targetRpe = [light, light];
    }
    const next = structuredClone(t),
      at = next.items.findIndex(
        i =>
          i.prescription?.block === 'cooldown' ||
          (role === 'accessory' && ['conditioning', 'mobility'].includes(i.prescription?.block ?? '')),
      );
    next.items.splice(at < 0 ? next.items.length : at, 0, item);
    if (test(next)) return 'new_' + role;
  }
  // Independently enumerate an additional legal warmup action inside its existing budget.
  const timing = timingRow(durationTier(t.targetMinutes ?? p.sessionMinutes, p, r), r);
  const safety = safetyBlockMinimums(t, p, r);
  for (const exercise of r.data.exercises) {
    if (
      !possible.has(exercise.id) ||
      used.has(exercise.id) ||
      !exercise.use.includes('warmup') ||
      !source.refill.new_warmup_modalities.includes(exercise.modality)
    )
      continue;
    const item = prescribe(exercise, p, r, g.restrictions, 'warmup', 1);
    if (exercise.modality === 'cardio' && 'durationSeconds' in item.target) {
      item.target.durationSeconds = Math.min(item.target.durationSeconds, timedCap(exercise));
      const light = Math.min(r.get('aerobic.intensity.rpe_scale').light_max, g.restrictions.maxRpe);
      item.prescription!.targetRpe = [light, light];
    }
    const next = structuredClone(t);
    const first = next.items.findIndex(row => row.prescription?.block !== 'warmup');
    next.items.splice(first < 0 ? next.items.length : first, 0, item);
    const warmup = independentElapsedSeconds(
      next.items.filter(row => row.prescription?.block === 'warmup'),
      r,
    );
    if (warmup <= Math.max(timing.warmup * 60, safety.warmupSeconds) && test(next)) return 'new_warmup';
  }
  return undefined;
}
