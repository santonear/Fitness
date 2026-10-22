import { expect, it } from 'vitest';
import { generatePlan, validatePlan } from '../../src/engine';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import { Rules } from '../../src/engine/data';
import { prescribe } from '../../src/engine/dose';
import { safety } from '../../src/engine/gates/strength-scoring';
it('enforces the existing source isometric hold range for ordinary working sets', () => {
  const p = baseProfile(),
    r = new Rules(),
    plan = generatePlan(p),
    e = r.data.exercises.find(e => e.modality === 'isometric' && e.primary_pattern !== 'balance')!;
  const item = prescribe(e, p, r, safety(p, r), 'accessory', 2);
  plan.templates[0].items.push(item);
  const bounds = r.get('dose.isometric')[p.level].hold_s;
  for (const seconds of [bounds[0] - 1, bounds[1] + 1]) {
    item.target = { metricType: 'duration', durationSeconds: seconds };
    expect(validatePlan(plan, p).some(i => i.code === 'isometric_hold_bounds')).toBe(true);
  }
  item.target = { metricType: 'reps', reps: 10 };
  expect(validatePlan(plan, p).some(i => i.code === 'isometric_hold_bounds')).toBe(true);
  for (const seconds of bounds) {
    item.target = { metricType: 'duration', durationSeconds: seconds };
    expect(validatePlan(plan, p).some(i => i.code === 'isometric_hold_bounds')).toBe(false);
  }
});
