import { assertBoundedDuration } from '../unit/engine/assert-bounded-duration';
import { expect, it } from 'vitest';
import { generatePlan, validatePlan } from '../../src/engine';
import { Rules } from '../../src/engine/data';
import { estimateSeconds } from '../../src/engine/fit';
import { goldenProfiles } from '../../tools/eval/training-engine-profiles';
import { isHardEligible } from '../../src/engine/candidates';
import { runGates } from '../../src/engine/gates';
import { independentElapsedAllocation } from '../unit/engine/reference/training-engine-goal-share';
import { verifyObservedGoalShares } from './v2-quality-observation';
it('selects eligible source work with real bounded time rather than requiring a removed candidate-search trace', () => {
  const p = goldenProfiles.find(x => x.id === 'mobility6x90')!.profile,
    r = new Rules(),
    plan = generatePlan(p),
    gate = runGates(p, r);
  expect(validatePlan(plan, p).filter(i => i.severity === 'error')).toEqual([]);
  verifyObservedGoalShares(plan, p, r);
  const short = assertBoundedDuration(plan, p, r);
  let working = 0;
  for (const t of plan.templates) {
    const actual = estimateSeconds(t, r),
      target = (t.targetMinutes ?? p.sessionMinutes) * 60,
      band = r.get('duration.fit.bounds').duration_band;
    expect(actual).toBe(independentElapsedAllocation({ templates: [t] }).total);
    if (actual < target * band[0])
      expect(short).toContainEqual(
        expect.objectContaining({ templateId: t.id, code: 'intentional_short', severity: 'warning' }),
      );
    else expect(actual).toBeGreaterThanOrEqual(target * band[0]);
    expect(actual).toBeLessThanOrEqual(target * band[1]);
    expect(t.estimatedSeconds).toBe(actual);
    for (const item of t.items.filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? ''))) {
      working++;
      const e = r.byExercise.get(item.exerciseId)!;
      expect(isHardEligible(e, p, gate, { rules: r })).toBe(true);
      expect(item.prescription?.perSide).toBe(e.time.per_side);
      if (e.modality === 'strength' && 'reps' in item.target) {
        expect(item.prescription?.secondsPerRep).toBe(
          Math.max(r.get('goal.params.mobility').rep_duration_min_s, e.time.s_per_rep ?? 0),
        );
        expect(item.prescription?.tempo).toEqual({ eccentricSeconds: 3, concentricSeconds: 1, pauseSeconds: 0 });
      }
    }
  }
  expect(working).toBeGreaterThan(0);
  const falseDisplay = structuredClone(plan);
  for (const t of falseDisplay.templates) {
    t.estimatedSeconds = 1;
    t.estimatedMinutes = 1;
  }
  expect(validatePlan(falseDisplay, p).filter(i => i.severity === 'error')).toEqual([]);
  expect(independentElapsedAllocation(falseDisplay)).toEqual(independentElapsedAllocation(plan));
});
