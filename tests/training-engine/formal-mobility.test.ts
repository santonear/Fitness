import { expect, it } from 'vitest';
import { generatePlan, validatePlan, modifyPlan } from '../../src/engine';
import { Rules } from '../../src/engine/data';

import { credit, prescribe } from '../../src/engine/dose';
import { estimatedSeconds } from '../../src/engine/fit/elapsed-time';
import { safety } from '../../src/engine/gates/strength-scoring';
import { goldenProfiles } from '../../tools/eval/training-engine-profiles';
import { independentElapsedAllocation } from '../unit/engine/reference/training-engine-goal-share';
const p = goldenProfiles.find(f => f.id === 'mobility6x90')!.profile,
  r = new Rules();
function actualRegions(t: ReturnType<typeof generatePlan>['templates'][number]) {
  const found = new Set<string>();
  for (const i of t.items.filter(i => i.prescription?.block === 'mobility')) {
    const e = r.byExercise.get(i.exerciseId)!;
    if (e.mobility_type === 'static') {
      if (e.stretch_targets?.some(g => ['quads', 'glutes', 'hamstrings'].includes(g))) found.add('lower_body');
      if (e.stretch_targets?.some(g => ['chest', 'back', 'shoulders'].includes(g))) found.add('upper_body');
    }
    if (
      e.mobility_type === 'dynamic' &&
      (e.primaryMuscles ?? []).some(m => ['core', 'lower_back'].includes(r.get('dose.muscle_groups').catalog_map[m]))
    )
      found.add('trunk');
  }
  return found;
}
function sourceRegionItems(
  _plan: ReturnType<typeof generatePlan>,
  t: ReturnType<typeof generatePlan>['templates'][number],
) {
  const slots = r
    .get('week.day.mobility')
    .slots.filter((slot: { pattern: string[] }) => slot.pattern.includes('mobility'));
  expect(slots.map((slot: { target: string }) => slot.target)).toEqual(['lower_body', 'upper_body', 'trunk']);
  return slots.map((slot: { pos: string; target: string }) => {
    const item = t.items.find(
      i => i.prescription?.sourcePosition?.endsWith('-' + slot.pos) || i.prescription?.sourcePosition === slot.pos,
    );
    expect(item, slot.pos).toBeDefined();
    const e = r.byExercise.get(item!.exerciseId)!;
    if (slot.target === 'trunk') {
      expect(e.mobility_type).toBe('dynamic');
      expect(
        (e.primaryMuscles ?? []).some(m => ['core', 'lower_back'].includes(r.get('dose.muscle_groups').catalog_map[m])),
      ).toBe(true);
    } else {
      expect(e.mobility_type, slot.pos + ':' + e.slug).toBe('static');
      const valid = slot.target === 'lower_body' ? ['quads', 'glutes', 'hamstrings'] : ['chest', 'back', 'shoulders'];
      expect(e.stretch_targets?.some(g => valid.includes(g))).toBe(true);
    }
    return item!;
  });
}
it('retains the source formal mobility regions and identities through public no-change reassessment', () => {
  const plan = generatePlan(p),
    t = plan.templates.find(t => t.items.some(i => i.prescription?.sourcePosition?.endsWith('-mob_1')))!;
  expect(t).toBeDefined();
  const source = sourceRegionItems(plan, t);
  expect(source).toHaveLength(3);
  for (const i of source) expect(i.prescription?.block).toBe('mobility');
  const before = structuredClone(plan),
    reassessed = modifyPlan(plan, p, []).value;
  expect(reassessed.templates).toEqual(before.templates);
  expect(plan).toEqual(before);
});
it('counts actual sides and mobility overhead without adding strength setup, ramp, rest or credit', () => {
  const plan = generatePlan(p),
    t = plan.templates.find(t => t.items.some(i => i.prescription?.block === 'mobility'))!,
    items = t.items.filter(i => i.prescription?.block === 'mobility');
  expect(items.length).toBeGreaterThan(0);
  const expected = items.reduce((sum, i) => {
      expect('durationSeconds' in i.target).toBe(true);
      const e = r.byExercise.get(i.exerciseId)!,
        side = e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1;
      expect(Object.keys(credit(i, r))).toEqual([]);
      return (
        sum +
        i.sets *
          (('durationSeconds' in i.target ? i.target.durationSeconds : 0) * side +
            r.get('duration.set.overhead').mobility_overhead_s_per_set)
      );
    }, 0),
    only = { ...t, items };
  expect(estimatedSeconds(only, r)).toBe(expected);
  expect(independentElapsedAllocation({ templates: [only] })).toEqual({
    resistance: 0,
    aerobic: 0,
    mobility: expected,
    other: 0,
    unallocated: 0,
    total: expected,
  });
});
it('does not hide missing formal regions or invalid selected static dose inside the new block', () => {
  const plan = generatePlan(p),
    t = plan.templates.find(t => t.items.some(i => i.prescription?.block === 'mobility'))!,
    missing = structuredClone(plan),
    target = missing.templates.find(tt => tt.id === t.id)!;
  target.items = target.items.filter(i => i.prescription?.block !== 'mobility');
  const declared = r
    .get('week.day.mobility')
    .slots.filter((slot: { target?: string }) => !!slot.target)
    .map((slot: { target: string }) => slot.target);
  expect(declared).toEqual(['lower_body', 'upper_body', 'trunk']);
  expect(target.items.some(i => i.prescription?.block === 'mobility')).toBe(false);
  expect(declared.filter((region: string) => !actualRegions(target).has(region))).toEqual(declared);
  const bad = structuredClone(plan),
    e = r.data.exercises.find(
      e => e.mobility_type === 'static' && e.use.includes('cooldown') && e.equipment_required.every(k => k === 'none'),
    )!,
    item = prescribe(e, p, r, safety(p, r), 'mobility', 1);
  bad.templates.find(tt => tt.id === t.id)!.items.push(item);
  expect(item).toBeDefined();
  item.sets = r.get('dose.stretch').reps_per_muscle[0] - 1;
  item.target = { metricType: 'duration', durationSeconds: r.get('dose.stretch').hold_s.range[1] + 1 };
  const errors = validatePlan(bad, p).filter(i => i.severity === 'error');
  expect(errors.some(i => i.code === 'stretch_hold_cap')).toBe(true);
  expect(errors.some(i => i.code === 'stretch_dose_bounds')).toBe(true);
});
it('aggregates the source per-muscle set ceiling across poses without counting sides as extra sets', () => {
  const plan = generatePlan(p),
    t = plan.templates[0],
    moves = r.data.exercises.filter(e => e.mobility_type === 'static' && e.stretch_targets?.includes('chest')),
    range = r.get('dose.stretch').reps_per_muscle,
    s = safety(p, r);
  expect(moves.length).toBeGreaterThanOrEqual(3);
  t.items = moves.slice(0, 3).map(e => {
    const i = prescribe(e, p, r, s, 'mobility', range[0]);
    i.sets = range[0];
    i.target = { metricType: 'duration', durationSeconds: r.get('dose.stretch').hold_s.default };
    return i;
  });
  expect(
    validatePlan(plan, p).some(
      i => i.code === 'stretch_group_set_cap' && i.reason === `chest:${3 * range[0]}>${range[1]}`,
    ),
  ).toBe(true);
  t.items = t.items.slice(0, 2);
  expect(validatePlan(plan, p).some(i => i.code === 'stretch_group_set_cap' && i.reason.startsWith('chest:'))).toBe(
    false,
  );
  const side = r.data.exercises.find(
    e => e.mobility_type === 'static' && e.stretch_targets?.includes('quads') && e.time.per_side,
  )!;
  expect(side).toBeDefined();
  const i = prescribe(side, p, r, s, 'mobility', range[1]);
  i.sets = range[1];
  t.items = [i];
  expect(validatePlan(plan, p).some(i => i.code === 'stretch_group_set_cap')).toBe(false);
});
