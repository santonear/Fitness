import { expect, it } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { prescribe } from '../../../src/engine/dose';
import { createContext } from '../../../src/engine/pipeline';
import { powerBranch, powerLoadIssue } from '../../../src/engine/power';
import { isHardEligible } from '../../../src/engine/candidates';
import { fixtureProfile } from './fixtures';
const rules = new Rules(),
  swing = rules.data.exercises.find(e => e.slug === 'one-arm-dumbbell-swing')!;
const profile = () => ({
  ...structuredClone(fixtureProfile),
  level: 'intermediate' as const,
  trainingAgeWeeks: 30,
  equipment: ['none', 'dumbbell'] as ('none' | 'dumbbell')[],
  screening: { ...fixtureProfile.screening, activityStatus: 'active' as const },
});
it('branch3 unknown1RM ignores numeric equipment loads, uses only a source band and RIR>=3 with the approved cue', () => {
  const p = { ...profile(), equipmentLoadsKg: { dumbbell: 999 } },
    ctx = createContext(p, 0, rules),
    item = prescribe(swing, p, rules, ctx.gate.restrictions);
  expect(powerBranch(swing, p, rules)?.kind).toBe('unknown_1rm');
  expect(item.target.metricType).toBe('reps');
  expect(item.target).not.toHaveProperty('loadGrams');
  expect(item.prescription!.loadBand).toBe('light');
  expect(item.prescription!.rir).toEqual([3, 3]);
  expect(item.prescription!.safetyCue!.zh).toBe('发力时速度明显变慢就停下这一组，宁可轻一点、快一点。');
  expect(powerLoadIssue(swing, item, p, rules)).toBeUndefined();
  for (const mutate of [
    (x: typeof item) => {
      x.target = { metricType: 'reps_load', reps: 3, loadGrams: 1000 };
    },
    (x: typeof item) => {
      x.prescription!.rir = [2, 3];
    },
    (x: typeof item) => {
      delete x.prescription!.safetyCue;
    },
    (x: typeof item) => {
      delete x.prescription!.loadBand;
    },
  ]) {
    const bad = structuredClone(item);
    mutate(bad);
    expect(powerLoadIssue(swing, bad, p, rules)).toBe('power_unknown_load');
  }
});
it.each(['user_record', 'reliable_estimate'] as const)(
  'branch2 accepts %s evidence, enforces inclusive30-70%%, never infers1RM from equipment loads',
  source => {
    const p = { ...profile(), powerOneRm: { [swing.id]: { kg: 20, source } } },
      ctx = createContext(p, 0, rules),
      item = prescribe(swing, p, rules, ctx.gate.restrictions);
    expect(item.target).toEqual({ metricType: 'reps_load', reps: 4, loadGrams: 10000 });
    for (const loadGrams of [6000, 14000])
      expect(
        powerLoadIssue(swing, { ...item, target: { metricType: 'reps_load', reps: 4, loadGrams } }, p, rules),
      ).toBeUndefined();
    for (const loadGrams of [5999, 14001, 0])
      expect(
        powerLoadIssue(swing, { ...item, target: { metricType: 'reps_load', reps: 4, loadGrams } }, p, rules),
      ).toBe('power_load_percent');
  },
);
it('branch1 bodyweight bypasses percentage only; beginner, impact, noise, skill and difficulty exclusions still apply', () => {
  const e = rules.data.exercises.find(
    e =>
      rules.get('dose.power').patterns.includes(e.primary_pattern) &&
      e.equipment_required.every(k => k === 'none') &&
      e.equipment_required.length,
  )!;
  expect(e).toBeDefined();
  const p = profile(),
    ctx = createContext(p, 0, rules),
    item = prescribe(e, p, rules, ctx.gate.restrictions);
  expect(powerBranch(e, p, rules)?.kind).toBe('bodyweight');
  expect(powerLoadIssue(e, item, p, rules)).toBeUndefined();
  expect(powerLoadIssue(e, { ...item, target: { metricType: 'reps_load', reps: 4, loadGrams: 100 } }, p, rules)).toBe(
    'power_bodyweight_load',
  );
  for (const altered of [
    { ...e, difficulty: 5 },
    { ...e, flags: [...e.flags, 'skill'] },
  ])
    expect(isHardEligible(altered, p, ctx.gate, ctx)).toBe(false);
  const beginner = { ...p, level: 'beginner' as const },
    b = createContext(beginner, 0, rules);
  expect(isHardEligible(e, beginner, b.gate, b)).toBe(false);
  const quiet = { ...p, constraints: { ...p.constraints, noJump: true, quiet: true } },
    q = createContext(quiet, 0, rules);
  if (e.impact || e.noise || e.flags.includes('jumping')) expect(isHardEligible(e, quiet, q.gate, q)).toBe(false);
});
