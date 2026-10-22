import { expect, it } from 'vitest';
import { generatePlan, validatePlan } from '../../../src/engine';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
it('rejects forged warmup seconds rather than using them to certify real duration', () => {
  const p = baseProfile(),
    plan = generatePlan(p);
  expect(validatePlan(plan, p)).toEqual([]);
  for (const block of ['main', 'accessory', 'conditioning'] as const) {
    const bad = structuredClone(plan),
      item = bad.templates[0].items.find(item => item.prescription?.block === 'main')!;
    item.prescription!.block = block;
    item.prescription!.warmupSeconds = 999;
    expect(validatePlan(bad, p)).toContainEqual(
      expect.objectContaining({ code: 'unverified_ramp_time', ruleId: 'duration.fit.bounds', severity: 'error' }),
    );
  }
});
it('a group label without real working partners cannot bypass the straight-set rest floor', () => {
  const p = baseProfile(),
    original = generatePlan(p);
  for (const structure of ['straight', 'superset', 'circuit'] as const) {
    const plan = structuredClone(original),
      item = plan.templates[0].items.find(item => item.prescription?.block === 'main' && item.sets > 1)!;
    item.prescription!.restSeconds = 0;
    item.prescription!.structure = structure;
    item.prescription!.groupId = structure === 'straight' ? undefined : 'not-a-real-working-group';
    expect(validatePlan(plan, p), structure).toContainEqual(
      expect.objectContaining({ code: 'rest_floor', ruleId: 'duration.fit.bounds', severity: 'error' }),
    );
  }
});
