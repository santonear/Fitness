import { it, expect } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { runGates } from '../../../src/engine/gates';
import { checkHard } from '../../../src/engine/hard-checks';
import type { EngineProfile, EnginePlan } from '../../../src/engine/contracts';
import { fixtureProfile, planFixture } from './fixtures';
const rules = new Rules(),
  iso = rules.data.exercises.find(e => e.slug === 'custom-standing-self-row-hold')!,
  statics = rules.data.exercises
    .filter(e => e.mobility_type === 'static' && e.stretch_targets?.includes('chest'))
    .slice(0, 3),
  dynamic = rules.data.exercises.find(e => e.mobility_type === 'dynamic')!;
type Item = EnginePlan['templates'][number]['items'][number];
function item(
  e: typeof iso,
  seconds: number,
  sets = 1,
  block: NonNullable<Item['prescription']>['block'] = 'mobility',
): Item {
  return {
    exerciseId: e.id,
    equipment: e.equipment_required[0],
    sets,
    target: { metricType: 'duration', durationSeconds: seconds },
    prescription: { pattern: e.primary_pattern, block, rir: [3, 3], restSeconds: 0, structure: 'straight' },
  };
}
function errors(items: Item[], profile: EngineProfile = fixtureProfile) {
  const plan = planFixture();
  plan.templates[0].items = items;
  return checkHard(plan, profile, runGates(profile, rules), rules);
}
it.each(['beginner', 'intermediate'] as const)(
  'enforces duration metric and source working isometric hold bounds for %s',
  level => {
    const profile = { ...fixtureProfile, level },
      range = rules.get('dose.isometric')[level].hold_s;
    for (const seconds of [range[0] - 1, range[1] + 1])
      expect(errors([item(iso, seconds, 2, 'accessory')], profile).some(i => i.code === 'isometric_hold_bounds')).toBe(
        true,
      );
    for (const metricType of ['reps', 'duration_distance'] as const) {
      const selected = item(iso, range[0], 2, 'main');
      selected.target = metricType === 'reps' ? { metricType, reps: 10 } : { metricType, durationSeconds: range[0] };
      expect(errors([selected], profile).some(i => i.code === 'isometric_hold_bounds')).toBe(true);
    }
    for (const seconds of range)
      expect(errors([item(iso, seconds, 2, 'main')], profile).some(i => i.code === 'isometric_hold_bounds')).toBe(
        false,
      );
  },
);
it('checks selected static holds and source-specific ranges without enforcing a target minimum of two sets', () => {
  const range = rules.get('dose.stretch').hold_s.range,
    e = statics[0];
  expect(e).toBeDefined();
  expect(errors([item(e, range[1] + 1)]).some(i => i.code === 'stretch_hold_cap')).toBe(true);
  expect(errors([item(e, range[0] - 1)]).some(i => i.code === 'stretch_dose_bounds')).toBe(true);
  const wrong = item(e, range[0]);
  wrong.target = { metricType: 'reps', reps: 10 };
  expect(errors([wrong]).some(i => i.code === 'stretch_dose_bounds')).toBe(true);
  expect(errors([item(e, range[1], 1, 'mobility')]).some(i => i.code.startsWith('stretch_'))).toBe(false);
  expect(errors([item(e, range[1], 1, 'cooldown')]).some(i => i.code.startsWith('stretch_'))).toBe(false);
  const sourced = rules.data.exercises.find(
    e => e.mobility_type === 'static' && e.stretch_hold_s && e.stretch_hold_s[0] > range[0],
  )!;
  expect(sourced).toBeDefined();
  expect(
    errors([item(sourced, sourced.stretch_hold_s![0] - 1)]).some(i => i.code === 'stretch_source_hold_bounds'),
  ).toBe(true);
  const older = {
      ...fixtureProfile,
      population: { kind: 'older_adult' as const, fallsAnswers: [false, false, false, false] },
      birthYearMonth: '1956-06',
    },
    olderRange = rules.get('dose.stretch').hold_s.older_adult;
  expect(errors([item(e, olderRange[0] - 1)], older).some(i => i.code === 'stretch_dose_bounds')).toBe(true);
});
it('aggregates static set caps per muscle across poses and stages without multiplying per-side sets', () => {
  const range = rules.get('dose.stretch').reps_per_muscle,
    hold = rules.get('dose.stretch').hold_s.default;
  expect(statics).toHaveLength(3);
  const over = statics.map((e, index) => item(e, hold, range[0], index === 0 ? 'warmup' : 'mobility'));
  expect(errors(over)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'stretch_group_set_cap',
        ruleId: 'dose.stretch',
        reason: `chest:${3 * range[0]}>${range[1]}`,
      }),
    ]),
  );
  expect(errors(over.slice(0, 2)).some(i => i.code === 'stretch_group_set_cap')).toBe(false);
  const side = rules.data.exercises.find(e => e.mobility_type === 'static' && e.time.per_side)!;
  expect(side).toBeDefined();
  expect(errors([item(side, hold, range[1])]).some(i => i.code === 'stretch_group_set_cap')).toBe(false);
});
it('does not turn dynamic mobility duration or missing stretch volume targets into static hard limits', () => {
  expect(
    errors([item(dynamic, rules.get('dose.stretch').hold_s.range[1] + 1)]).some(i => i.code.startsWith('stretch_')),
  ).toBe(false);
  expect(
    errors([item(statics[0], rules.get('dose.stretch').hold_s.range[0], 1, 'cooldown')]).some(
      i => i.code === 'stretch_dose_bounds' || i.code === 'stretch_group_set_cap',
    ),
  ).toBe(false);
});
