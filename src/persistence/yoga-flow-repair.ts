import { Rules } from '../engine/data';
import { YOGA_POSITION_PREFIX } from '../engine/yoga-session';

type Item = { exerciseId: string; target: { metricType: string }; prescription?: { sourcePosition?: string } };
type Repairable = { templates: { items: Item[] }[]; enginePlan?: { templates: { items: Item[] }[] } };

let rules: Rules | undefined;

/**
 * Bo 2026-10-27: yoga plans saved before 2026-10-27 hold the two reps-counted flows (dog to plank, dog to
 * upward dog) as timed holds, while a workout records them in reps. They become a rep target the hard check
 * accepts for every level. Idempotent: a repaired plan has nothing left to repair. Returns only changed rows.
 */
export function repairYogaFlowTargets<T extends Repairable>(versions: readonly T[]): T[] {
  const r = (rules ??= new Rules()),
    reps = Math.max(...(Object.values(r.get('dose.reps.bounds').min) as number[])) + 1;
  const stale = (item: Item) =>
    !!item.prescription?.sourcePosition?.startsWith(YOGA_POSITION_PREFIX) &&
    item.target.metricType === 'duration' &&
    r.byExercise.get(item.exerciseId)?.metricType === 'reps';
  const fix = (templates: { items: Item[] }[]) =>
    templates.map(template => ({
      ...template,
      items: template.items.map(item => (stale(item) ? { ...item, target: { metricType: 'reps', reps } } : item)),
    }));
  return versions.flatMap(version => {
    const all = [...version.templates, ...(version.enginePlan?.templates ?? [])];
    if (!all.some(template => template.items.some(stale))) return [];
    return [
      {
        ...version,
        templates: fix(version.templates),
        ...(version.enginePlan
          ? { enginePlan: { ...version.enginePlan, templates: fix(version.enginePlan.templates) } }
          : {}),
      },
    ];
  });
}
