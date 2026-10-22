import { expect, it } from 'vitest';
import { classifyPlan, environmentStatistics } from '../../tools/eval/training-engine-audit';
import { independentBalanceEnvironmentConstraint } from '../../tools/eval/training-engine-quality';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import { Rules } from '../../src/engine/data';
import { planFixture } from '../unit/engine/fixtures';
const rules = new Rules(),
  id = 'older.template.balance_required';
function fixture() {
  const profile = baseProfile({
      place: 'outdoor',
      householdSupport: false,
      population: { kind: 'older_adult', balanceCautious: true, fallsAnswers: [false, false, false, false] },
      birthYearMonth: '1956-06',
    }),
    plan = planFixture();
  plan.quality = {
    status: 'environmentLimited',
    basis: 'environment_constraint',
    issues: [],
    environmentConstraints: [{ ruleId: id, patterns: ['balance'], issueCodes: ['balance_days'] }],
  };
  return { profile, plan };
}
it('independently accepts source-scoped balance environment vacuum with no hard error or trusted warning', () => {
  const { profile, plan } = fixture();
  expect(independentBalanceEnvironmentConstraint(profile, rules)).toEqual(plan.quality!.environmentConstraints![0]);
  expect(classifyPlan(plan, profile, [])).toMatchObject({ status: 'environment_limited', blocked: false });
});
it.each(['balance_days', 'duration_tolerance'])(
  'never excuses a real hard error including the former balance hard code: %s',
  code => {
    const { profile, plan } = fixture();
    expect(
      classifyPlan(plan, profile, [
        {
          code,
          ruleId: code === 'balance_days' ? id : 'duration.fit.bounds',
          severity: 'error',
          reason: 'actual unsafe condition',
        },
      ]).status,
    ).toBe('fail');
  },
);
it('rejects a warning and claim when support already makes actual balance candidates possible', () => {
  const { profile, plan } = fixture(),
    exception = rules.get(id).environment_exception;
  profile.equipment.push('wall', 'chair');
  expect(
    classifyPlan(plan, profile, [
      { code: exception.warning_code, ruleId: id, severity: 'warning', reason: 'untrusted claim' },
    ]).status,
  ).toBe('fail');
});
it('rejects non-environment exclusion, missing source scope, forged claims and blocked screening', () => {
  for (const mode of ['excluded', 'scope', 'claim', 'blocked'] as const) {
    const { profile, plan } = fixture();
    if (mode === 'excluded')
      profile.preferences.excludedExerciseIds = rules.data.exercises
        .filter(e => e.primary_pattern === 'balance')
        .map(e => e.id);
    if (mode === 'scope') {
      profile.place = 'home';
      profile.householdSupport = true;
    }
    if (mode === 'claim') plan.quality!.environmentConstraints![0].patterns = ['push_horizontal'];
    if (mode === 'blocked')
      plan.gates.push({ ruleId: 'safety.screen.parq', status: 'blocked', reason: 'unknown answers' });
    expect(classifyPlan(plan, profile, []).status, mode).toBe('fail');
  }
});
it('retains separate weighted and extreme environment accounting', () => {
  expect(environmentStatistics(2, 50, 2000)).toMatchObject({ weighted: 2, extreme: 50, weightedFraction: 0.001 });
});

it('fails a nonblocked empty plan even when every catalogue item is explicitly excluded', () => {
  const { profile, plan } = fixture();
  profile.preferences.excludedExerciseIds = rules.data.exercises.map(e => e.id);
  plan.templates = [];
  plan.quality = { status: 'unavailable', basis: 'no_safe_candidates', issues: [] };
  expect(classifyPlan(plan, profile, []).status).toBe('fail');
});
