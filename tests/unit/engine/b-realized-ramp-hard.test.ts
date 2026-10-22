import { it, expect } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { runGates } from '../../../src/engine/gates';
import { checkHard } from '../../../src/engine/hard-checks';
import { prescribe, type Template } from '../../../src/engine/dose';
import { realizeBodyweightWarmup, isRealizedBodyweightWarmup } from '../../../src/engine/source-warmup';
import { fixtureProfile, planFixture } from './fixtures';
const rules = new Rules(),
  profile = { ...structuredClone(fixtureProfile), sessionMinutes: 30 },
  gate = runGates(profile, rules),
  exercise = rules.data.exercises.find(e => e.slug === 'bodyweight-squat')!;
function fixture(): Template {
  const main = prescribe(exercise, profile, rules, gate.restrictions, 'main', 3);
  main.target = { metricType: 'reps', reps: 8 };
  main.prescription!.sourcePosition = 'ramp-day-M1-main_1';
  const warm = structuredClone(main);
  warm.prescription!.block = 'warmup';
  warm.prescription!.sourcePosition = 'ramp-day-WU3';
  return realizeBodyweightWarmup(
    { id: 'ramp-day', name: 'Ramp', estimatedMinutes: 30, items: [warm, main] },
    profile,
    rules,
  );
}
function errors(t: Template, r = rules) {
  const plan = planFixture();
  plan.templates = [t];
  return checkHard(plan, profile, runGates(profile, r), r);
}
const exceptional = (t: Template) => errors(t).filter(e => ['reps_bounds', 'duplicate_exercise'].includes(e.code));
it('accepts one re-proven source half-repetition ramp before the same bodyweight main', () => {
  const t = fixture();
  expect(rules.get('variety.no_repeat').ramp_sets_exempt).toBe(true);
  expect(isRealizedBodyweightWarmup(t, 0, profile, rules)).toBe(true);
  expect(t.items[0].target).toEqual({ metricType: 'reps', reps: 4 });
  expect(exceptional(t)).toEqual([]);
});
it.each(['position', 'order', 'sets', 'reps', 'group', 'load', 'cadence', 'side'] as const)(
  'does not grant source-ramp exceptions to forged %s',
  kind => {
    const t = fixture(),
      warm = t.items[0];
    if (kind === 'position') warm.prescription!.sourcePosition = 'unknown-WU3';
    if (kind === 'order') t.items.reverse();
    if (kind === 'sets') warm.sets++;
    if (kind === 'reps') warm.target = { metricType: 'reps', reps: 5 };
    if (kind === 'group') warm.prescription!.groupId = 'fake';
    if (kind === 'load') warm.target = { metricType: 'reps_load', reps: 4, loadGrams: 1000 };
    if (kind === 'cadence') warm.prescription!.secondsPerRep = (warm.prescription!.secondsPerRep ?? 0) + 1;
    if (kind === 'side') warm.prescription!.perSide = true;
    expect(isRealizedBodyweightWarmup(t, kind === 'order' ? 1 : 0, profile, rules)).toBe(false);
    expect(exceptional(t).length).toBeGreaterThan(0);
  },
);
it('still rejects a second working duplicate while leaving the true warmup exemption intact', () => {
  const t = fixture(),
    duplicate = structuredClone(t.items[1]);
  delete duplicate.prescription!.sourcePosition;
  t.items.push(duplicate);
  expect(isRealizedBodyweightWarmup(t, 0, profile, rules)).toBe(true);
  expect(errors(t).some(e => e.code === 'duplicate_exercise' && e.itemIndex === 2)).toBe(true);
});
it.each([0, 1])('never exempts explicitly excluded previous identity at item %i', index => {
  const t = fixture();
  t.items[index].prescription!.excludedPreviousIds = [t.items[index].exerciseId];
  expect(isRealizedBodyweightWarmup(t, 0, profile, rules)).toBe(true);
  expect(errors(t).some(e => e.code === 'duplicate_exercise' && e.itemIndex === index)).toBe(true);
});
it('preserves working minimum repetitions and the absolute maximum even for a re-proven warmup', () => {
  const t = fixture();
  t.items[1].target = { metricType: 'reps', reps: 4 };
  const low = realizeBodyweightWarmup(t, profile, rules);
  expect(isRealizedBodyweightWarmup(low, 0, profile, rules)).toBe(true);
  expect(errors(low).some(e => e.code === 'reps_bounds' && e.itemIndex === 1)).toBe(true);
  t.items[1].target = { metricType: 'reps', reps: rules.get('dose.reps.bounds').absolute_max * 3 };
  const high = realizeBodyweightWarmup(t, profile, rules);
  expect(isRealizedBodyweightWarmup(high, 0, profile, rules)).toBe(true);
  expect(errors(high).some(e => e.code === 'reps_bounds' && e.itemIndex === 0)).toBe(true);
});
