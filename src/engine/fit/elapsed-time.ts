import { EngineProfile } from '../contracts';
import { Rules, Exercise } from '../data';
import { Item, Template } from '../dose';
import { sourceWarmupRamps as authenticatedWarmupRamps } from '../source-warmup';

export function setSeconds(item: Item, e: Exercise, r: Rules): number {
  const overhead = r.get('duration.set.overhead');
  const side = item.prescription?.perSide || e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1;
  if ('durationSeconds' in item.target)
    return (
      item.target.durationSeconds * side +
      (e.modality === 'mobility' ? overhead.mobility_overhead_s_per_set : overhead.overhead_s_per_set)
    );
  return (
    item.target.reps *
      (item.prescription?.secondsPerRep ?? e.time.s_per_rep ?? r.get('duration.rep.seconds').default_if_unknown) *
      side +
    overhead.overhead_s_per_set
  );
}

export function blockSeconds(template: Template, block: 'warmup' | 'cooldown', r: Rules): number {
  return template.items
    .filter(item => item.prescription?.block === block)
    .reduce((sum, item) => {
      const e = r.byExercise.get(item.exerciseId);
      return sum + (e ? item.sets * setSeconds(item, e, r) : 0);
    }, 0);
}

export function actualWarmupSeconds(template: Template, p: EngineProfile, r: Rules): number {
  return (
    blockSeconds(template, 'warmup', r) +
    authenticatedWarmupRamps(template, p, r).reduce(
      (sum, entry) =>
        sum + (template.items[entry.itemIndex].prescription?.warmupSeconds === entry.seconds ? entry.seconds : 0),
      0,
    )
  );
}

export interface ElapsedAllocation {
  resistance: number;
  aerobic: number;
  mobility: number;
  other: number;
  unallocated: number;
  total: number;
}

export function elapsedCategory(e: Exercise): 'resistance' | 'aerobic' | 'mobility' | 'other' {
  return e.primary_pattern === 'balance'
    ? 'other'
    : e.modality === 'cardio'
      ? 'aerobic'
      : e.modality === 'mobility'
        ? 'mobility'
        : ['strength', 'isometric'].includes(e.modality)
          ? 'resistance'
          : 'other';
}

export function elapsedAllocation(template: Template, r: Rules): ElapsedAllocation {
  const allocation: ElapsedAllocation = {
    resistance: 0,
    aerobic: 0,
    mobility: 0,
    other: 0,
    unallocated: 0,
    total: 0,
  };
  allocation.total = estimatedSeconds(template, r, allocation);
  return allocation;
}

export function weeklyElapsedAllocation(templates: Template[], r: Rules): ElapsedAllocation {
  return templates.reduce(
    (sum, template) => {
      const current = elapsedAllocation(template, r);
      for (const key of Object.keys(sum) as (keyof ElapsedAllocation)[]) sum[key] += current[key];
      return sum;
    },
    {
      resistance: 0,
      aerobic: 0,
      mobility: 0,
      other: 0,
      unallocated: 0,
      total: 0,
    },
  );
}

export function estimatedSeconds(template: Template, r: Rules, allocation?: ElapsedAllocation): number {
  let total = 0;
  const seen = new Set<string>();
  const transition = r.get('duration.transition.setup');
  for (const [index, item] of template.items.entries()) {
    const e = r.byExercise.get(item.exerciseId);
    if (!e) continue;
    if (
      item.prescription?.block === 'warmup' ||
      item.prescription?.block === 'cooldown' ||
      item.prescription?.block === 'mobility'
    ) {
      const seconds = item.sets * setSeconds(item, e, r);
      total += seconds;
      if (allocation) allocation[elapsedCategory(e)] += seconds;
      continue;
    }
    const structure = item.prescription?.structure ?? 'straight',
      group = structure === 'straight' ? undefined : item.prescription?.groupId,
      key = group ? `${structure}:${group}` : undefined;
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    const members = group
      ? template.items.filter(
          i =>
            i.prescription?.groupId === group &&
            i.prescription.structure === structure &&
            !['warmup', 'cooldown'].includes(i.prescription.block),
        )
      : [item];
    const exercises = members.map(i => r.byExercise.get(i.exerciseId)).filter((e): e is Exercise => !!e);
    if (members.length === 1 && e.modality === 'cardio' && 'durationSeconds' in item.target) {
      const seconds =
        item.target.durationSeconds *
        item.sets *
        (item.prescription?.perSide || e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1);
      total += seconds;
      if (allocation) allocation.aerobic += seconds;
      continue;
    }
    const setup = exercises.reduce((n, e) => n + e.time.setup_s, 0) + transition.buffer_s;
    if (members.length > 1 && structure !== 'straight') {
      const v = r.get('duration.rest.block')[structure];
      const rounds = Math.max(...members.map(i => i.sets)),
        roundRest =
          structure === 'superset'
            ? Math.max(
                v.after_round_range_s[0],
                ...members.map(i => i.prescription?.roundRestSeconds ?? v.after_round_s),
              )
            : v.after_round_s;
      // Unequal sets are counted individually; idle rounds do not invent extra work.
      const work = members.reduce((sum, i) => {
        const ex = r.byExercise.get(i.exerciseId)!;
        return sum + i.sets * setSeconds(i, ex, r);
      }, 0);
      const transitions = Array.from({ length: rounds }, (_, round) =>
        Math.max(0, members.filter(member => member.sets > round).length - 1),
      ).reduce((sum, count) => sum + count, 0);
      total += setup + work + transitions * (v.between_exercises_s ?? v.between_stations_s) + (rounds - 1) * roundRest;
      if (allocation) {
        const categories = new Set(exercises.map(elapsedCategory));
        for (const member of members) {
          const ex = r.byExercise.get(member.exerciseId)!;
          allocation[elapsedCategory(ex)] += member.sets * setSeconds(member, ex, r) + ex.time.setup_s;
        }
        allocation[categories.size === 1 ? elapsedCategory(e) : 'unallocated'] +=
          transition.buffer_s +
          transitions * (v.between_exercises_s ?? v.between_stations_s) +
          (rounds - 1) * roundRest;
      }
    } else {
      const seconds =
        setup +
        item.sets * setSeconds(item, e, r) +
        (item.sets - 1) *
          (item.prescription?.restSeconds ??
            r.get('duration.rest.straight').rest_s[e.nsca_class === 'isolation' ? 'isolation' : 'compound']);
      total += seconds;
      if (allocation) allocation[elapsedCategory(e)] += seconds;
    }
    const ramp = members.reduce((sum, member) => sum + (member.prescription?.warmupSeconds ?? 0), 0);
    total += ramp;
    if (allocation) allocation.resistance += ramp;
    if (index === 0 && item.prescription?.block !== 'main') continue;
  }
  return total;
}
