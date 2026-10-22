import { assertBoundedDuration } from './assert-bounded-duration';
import { expect, it } from 'vitest';
import { enginePlanSchema } from '../../../src/engine/contracts';
import { createContext, generatePlan } from '../../../src/engine/pipeline';
import { checkHard } from '../../../src/engine/hard-checks';
import { typicalProfiles, planFixture, sessionFixture } from './fixtures';
it('keeps ten representative and independent hand-built D-lane fixtures', () => {
  expect(typicalProfiles).toHaveLength(10);
  expect(sessionFixture().items).toHaveLength(1);
  expect(enginePlanSchema.safeParse(planFixture()).success).toBe(true);
});
it.each(typicalProfiles.map((profile, index) => ({ profile, index })))(
  'runs the P0 interfaces deterministically for typical profile $index',
  ({ profile }) => {
    const before = structuredClone(profile),
      ctx = createContext(profile),
      plan = generatePlan(profile);
    expect(enginePlanSchema.safeParse(plan).success).toBe(true);
    expect(JSON.stringify(generatePlan(profile))).toBe(JSON.stringify(plan));
    expect(profile).toEqual(before);
    if (ctx.gate.status === 'blocked') {
      expect(plan.templates).toEqual([]);
      expect(plan.gates.some(g => g.status === 'blocked')).toBe(true);
    } else {
      expect(plan.templates).toHaveLength(profile.daysPerWeek);
      assertBoundedDuration(plan, profile, ctx.rules);
    }
    expect(plan.notices.length).toBeLessThanOrEqual(3);
    const rows = plan.quality?.perRule ?? [],
      weight = rows.reduce((n, r) => n + r.weight, 0);
    expect(plan.quality?.score).toBeCloseTo(
      weight ? rows.reduce((n, r) => n + r.weight * r.satisfaction, 0) / weight : 0,
      12,
    );
  },
);
it('keeps hard rejection of an unknown exercise after replacing the interface stub', () => {
  const p = typicalProfiles[0],
    ctx = createContext(p),
    plan = planFixture();
  plan.templates[0].items[0].exerciseId = 'unknown';
  expect(checkHard(plan, p, ctx.gate).some(v => v.code === 'unknown_exercise' && v.ruleId === 'select.pipeline')).toBe(
    true,
  );
});
it('uses the approved safe walking fallback instead of returning an empty small-space postpartum plan', () => {
  const profile = structuredClone(typicalProfiles[7]);
  profile.constraints.space = 'medium';
  const context = createContext(profile);
  const plan = generatePlan(profile);
  const fallback = context.rules.get('postpartum.gate.caesarean').candidate_fallback.exercise_id;
  expect(plan.templates).toHaveLength(profile.daysPerWeek);
  expect(plan.templates.every(template => template.items.length > 0)).toBe(true);
  expect(plan.templates.flatMap(template => template.items).every(item => item.exerciseId === fallback)).toBe(true);
  expect(plan.gates.some(gate => gate.status === 'blocked')).toBe(false);
  expect(checkHard(plan, profile, context.gate, context.rules)).toEqual([]);
});
it('rejects a fabricated environment outcome while legal candidates remain', () => {
  const p = typicalProfiles[0],
    ctx = createContext(p),
    plan = planFixture();
  plan.templates = [];
  plan.quality = {
    status: 'unavailable',
    basis: 'no_safe_candidates',
    issues: [],
  };
  expect(checkHard(plan, p, ctx.gate).some(v => v.code === 'empty_plan')).toBe(true);
});
it('retains an applicable environmental draft and an explicit non-error source exemption when required balance candidates are absent', () => {
  const p = structuredClone(typicalProfiles[8]);
  p.population = {
    kind: 'older_adult',
    fallsAnswers: [false, false, false, false],
    balanceCautious: true,
  };
  p.equipment = ['none'];
  p.place = 'outdoor';
  p.householdSupport = false;
  p.constraints.space = 'mat';
  const plan = generatePlan(p);
  expect(plan.templates.length).toBeGreaterThan(0);
  expect(plan.quality).toMatchObject({
    status: 'environmentLimited',
    basis: 'environment_constraint',
    environmentConstraints: [
      {
        ruleId: 'older.template.balance_required',
        patterns: ['balance'],
        issueCodes: ['balance_days'],
      },
    ],
  });
  expect(
    plan.quality?.issues.some(
      i =>
        i.code === createContext(p).rules.get('older.template.balance_required').environment_exception.warning_code &&
        i.severity === 'warning',
    ),
  ).toBe(true);
  expect(plan.gates.some(g => g.status === 'blocked')).toBe(false);
  expect(plan.notices[0].code).toBe('engine.copy.environment_balance');
  expect(enginePlanSchema.safeParse(plan).success).toBe(true);
});
