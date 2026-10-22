import { it, expect } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { createContext } from '../../../src/engine/pipeline';
import { candidatesFor, isHardEligible } from '../../../src/engine/candidates';
import { prescribe } from '../../../src/engine/dose';
import type { EngineProfile, Slot } from '../../../src/engine/contracts';
import { fixtureProfile } from './fixtures';
const full = new Rules(),
  swing = full.data.exercises.find(e => e.slug === 'one-arm-dumbbell-swing')!,
  hinge = full.data.exercises.find(e => e.slug === 'bodyweight-good-morning')!,
  rules = new Rules({ ...full.data, exercises: [swing, hinge] }),
  power = rules.get('dose.power');
const slot: Slot = {
  id: 'source-power',
  role: 'main',
  patterns: ['hinge'],
  priority: 1,
  optional: false,
  sourceRuleId: 'select.pipeline',
};
function profile(activityStatus: 'active' | 'inactive'): EngineProfile {
  return {
    ...structuredClone(fixtureProfile),
    level: 'intermediate',
    trainingAgeWeeks: 30,
    equipment: ['none', 'dumbbell'],
    constraints: { noJump: false, quiet: false, space: 'large' },
    screening: { ...fixtureProfile.screening, activityStatus },
  };
}
it('filters a power candidate when the inactive safety RIR cannot intersect the source power interval', () => {
  const p = profile('inactive'),
    ctx = createContext(p, 0, rules),
    before = JSON.stringify({ profile: p, state: ctx.gate.restrictions });
  expect(ctx.gate.status).not.toBe('blocked');
  expect(ctx.gate.restrictions.rirMin).toBeGreaterThan(power.rir[1]);
  // Prescribing this action in isolation demonstrates why it must not enter a candidate pool.
  expect(prescribe(swing, p, rules, ctx.gate.restrictions, 'main').prescription!.rir[0]).toBeGreaterThan(power.rir[1]);
  expect(isHardEligible(swing, p, ctx.gate, ctx)).toBe(false);
  expect(candidatesFor(slot, p, ctx.gate, ctx).map(e => e.id)).toEqual([hinge.id]);
  expect(JSON.stringify({ profile: p, state: ctx.gate.restrictions })).toBe(before);
});
it('retains power when safety and source RIR do intersect, including their shared upper boundary', () => {
  const p = profile('active'),
    ctx = createContext(p, 0, rules);
  expect(isHardEligible(swing, p, ctx.gate, ctx)).toBe(true);
  ctx.gate.restrictions.rirMin = power.rir[1];
  expect(isHardEligible(swing, p, ctx.gate, ctx)).toBe(true);
  const item = prescribe(swing, p, rules, ctx.gate.restrictions, 'main');
  expect(item.prescription!.rir).toEqual([power.rir[1], power.rir[1]]);
});
it('invalidates the eligible-pool cache after an in-place safety RIR change without changing the profile', () => {
  const p = profile('active'),
    ctx = createContext(p, 0, rules);
  expect(candidatesFor(slot, p, ctx.gate, ctx).some(e => e.id === swing.id)).toBe(true);
  const inactive = createContext(profile('inactive'), 0, rules);
  ctx.gate.restrictions.rirMin = inactive.gate.restrictions.rirMin;
  expect(candidatesFor(slot, p, ctx.gate, ctx).map(e => e.id)).toEqual([hinge.id]);
  ctx.gate.restrictions.rirMin = power.rir[1];
  expect(candidatesFor(slot, p, ctx.gate, ctx).some(e => e.id === swing.id)).toBe(true);
});
