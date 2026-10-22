import { expect, it } from 'vitest';
import { generatePlan, validatePlan } from '../../src/engine';
import { Rules, stretchHoldRange } from '../../src/engine/data';
import { engineProfileSchema, type EngineProfile } from '../../src/engine/contracts';
import { prescribe, credit } from '../../src/engine/dose';
import { safety } from '../../src/engine/gates/strength-scoring';
import { runGates } from '../../src/engine/gates';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import profile from '../fixtures/training-engine/start-cold-residual37.json';
import { actualBlockSeconds } from '../unit/engine/reference/training-engine-session-time';
import { independentElapsedAllocation } from '../unit/engine/reference/training-engine-goal-share';
const p = {
  ...profile,
  screening: {
    ...profile.screening,
    cmrSymptoms: baseProfile().screening.cmrSymptoms,
  },
} as EngineProfile;
completeJointReview(p);
if (p.population.kind === 'pregnant') p.population = { ...p.population, prenatalCareConfirmed: true };
const r = new Rules();
function fixture() {
  const q = baseProfile({
      goal: 'start_moving',
      level: 'intermediate',
      sessionMinutes: 37,
    }),
    plan = generatePlan(q),
    e = r.data.exercises.find(e => e.slug === 'banded-chest-stretch')!,
    cold = prescribe(e, q, r, safety(q, r), 'cooldown', 2);
  cold.sets = 2;
  cold.target = {
    metricType: 'duration',
    durationSeconds: r.get('dose.stretch').hold_s.range[0],
  };
  plan.templates = [{ ...plan.templates[0], items: [cold] }];
  return { q, plan, cold, e };
}
it('preserves the saved requested duration rather than reconstructing a V1 deterministic residual', () => {
  expect(engineProfileSchema.safeParse(p).success).toBe(true);
  const plan = generatePlan(p);
  expect(plan.templates.length).toBeGreaterThan(0);
  for (const t of plan.templates) {
    const ramp = r.get('pregnancy.week.target').previously_inactive;
    const target =
      p.population.kind === 'pregnant' && p.screening.activityStatus === 'inactive'
        ? Math.min(
            p.sessionMinutes,
            ramp.first_week_minutes + Math.floor(p.trainingAgeWeeks) * ramp.weekly_increment_minutes,
            ramp.max_minutes,
          )
        : p.sessionMinutes;
    expect(plan.sessionMinutes).toBe(p.sessionMinutes);
    expect(t.targetMinutes).toBe(target);
    expect(t.estimatedSeconds).toBeCloseTo(independentElapsedAllocation({ templates: [t] }).total, 6);
  }
  expect(validatePlan(plan, p).filter(i => i.severity === 'error')).toEqual([]);
});
it.each([11, 12])('accepts another source-legal %i-second hold independent of deterministic factory choice', hold => {
  const { q, plan, cold, e } = fixture();
  expect(hold).toBeGreaterThanOrEqual(stretchHoldRange(e, r, q.population.kind)![0]);
  expect(hold).toBeLessThanOrEqual(stretchHoldRange(e, r, q.population.kind)![1]);
  cold.target = { metricType: 'duration', durationSeconds: hold };
  const expected =
      cold.sets *
      (hold * (e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1) +
        r.get('duration.set.overhead').mobility_overhead_s_per_set),
    t = plan.templates[0];
  expect(actualBlockSeconds(t, 'cooldown')).toBe(expected);
  t.estimatedSeconds = 999999;
  t.estimatedMinutes = 1;
  expect(actualBlockSeconds(t, 'cooldown')).toBe(expected);
  expect(validatePlan(plan, q).some(i => i.ruleId === 'dose.stretch')).toBe(false);
});
it('rejects malformed declared targets and actual out-of-source holds', () => {
  const { q, plan, cold } = fixture();
  for (const target of [1, 91, 22.5]) {
    plan.templates[0].targetMinutes = target;
    expect(validatePlan(plan, q).some(i => i.code === 'declared_target_invalid' && i.severity === 'error')).toBe(true);
  }
  cold.target = { metricType: 'duration', durationSeconds: 999 };
  expect(validatePlan(plan, q).some(i => i.code === 'stretch_dose_bounds' && i.severity === 'error')).toBe(true);
});
it('does not manufacture muscle credit from excluded static modality or zero-effort work', () => {
  const { q, cold } = fixture();
  cold.prescription!.block = 'accessory';
  expect(r.get('dose.volume.fractional').excluded_modalities).toContain(r.byExercise.get(cold.exerciseId)!.modality);
  expect(Object.values(credit(cold, r)).every(v => v === 0)).toBe(true);
  const e = r.data.exercises.find(e => e.slug === 'knee-push-ups')!,
    zero = prescribe(e, q, r, safety(q, r), 'accessory', 2);
  zero.prescription!.rir = [5, 5];
  expect(Object.values(credit(zero, r)).every(v => v === 0)).toBe(true);
});
it('requires real clearance and age-appropriate screening instead of optimistic replay certification', () => {
  const reviewed = structuredClone(p);
  reviewed.screening.parqAnswers![0] = true;
  expect(runGates(reviewed, r).status).not.toBe('allowed');
  const older = {
    ...p,
    population: { kind: 'general' as const },
    birthYearMonth: '1950-01',
  };
  expect(runGates(older, r).restrictions.population).toBe('older_adult');
  const missing = structuredClone(p);
  delete missing.screening.cmrSymptoms;
  expect(generatePlan(missing).templates).toEqual([]);
});
it('intersects the verified action-specific minimum with the global hold range', () => {
  const back = r.data.exercises.find(e => e.slug === 'custom-standing-upper-back-stretch')!;
  expect(back.stretch_hold_s).toEqual([15, 30]);
  expect(stretchHoldRange(back, r, 'general')).toEqual([15, 30]);
  const { q, plan, cold } = fixture();
  cold.exerciseId = back.id;
  cold.target = { metricType: 'duration', durationSeconds: 14 };
  expect(validatePlan(plan, q).some(i => i.code === 'stretch_dose_bounds')).toBe(true);
  cold.target.durationSeconds = 15;
  expect(validatePlan(plan, q).some(i => i.code === 'stretch_dose_bounds')).toBe(false);
});

// Explicit synthetic negative answers for this positive-control fixture; raw legacy JSON stays untouched.
function completeJointReview<T extends { cautions: string[]; screening: any; asOfDate?: string }>(p: T): T {
  if (!p.cautions.filter(j => j !== 'other').length) return p;
  const rules = new Rules(),
    joint = rules.get('redflag.joint_any'),
    back = rules.get('redflag.back'),
    shoulder = rules.get('redflag.shoulder'),
    keys = [
      ...joint.items,
      ...(p.cautions.includes('back') ? [...back.emergency_items, ...back.urgent_items] : []),
      ...(p.cautions.includes('shoulder') ? [...shoulder.cardiac_route_items, ...shoulder.prompt_medical_items] : []),
    ],
    at = p.asOfDate + 'T00:00:00.000Z';
  p.screening.redFlagReview = {
    requiredAt: at,
    answeredAt: at,
    areas: p.cautions,
    questionKeys: keys,
    answers: Object.fromEntries(keys.map((k: string) => [k, false])),
  };
  return p;
}
