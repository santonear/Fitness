import { expect, it } from 'vitest';
import { checkHard } from '../../../src/engine/hard-checks';
import { createContext, generatePlan, retainLastHardSafe } from '../../../src/engine/pipeline';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
import { boundedCardioPlanFixture as planFixture } from './bounded-cardio-fixture';
import { applicableEnginePlan } from '../../../src/engine/environment';

const profile = baseProfile({
  daysPerWeek: 1,
  sessionMinutes: 10,
  constraints: { noJump: false, quiet: false, space: 'large' },
});

it('keeps an unchanged hard-safe complete plan', () => {
  const context = createContext(profile);
  const plan = planFixture();
  expect(checkHard(plan, profile, context.gate, context.rules)).toEqual([]);
  expect(retainLastHardSafe(plan, undefined, context, 'assemble')).toBe(plan);
});

it.each(['improve', 'continuous-cardio', 'final-return'])(
  'rejects an unsafe %s candidate, restores the full checkpoint and records the reason',
  stage => {
    const context = createContext(profile);
    const previous = planFixture();
    const before = structuredClone(previous);
    const candidate = structuredClone(previous);
    candidate.templates[0].items[0].sets = 999;
    const result = retainLastHardSafe(candidate, previous, context, stage);
    expect(checkHard(result, profile, context.gate, context.rules)).toEqual([]);
    expect(result.templates).toEqual(before.templates);
    expect(previous).toEqual(before);
    expect(result.trace).toContainEqual(
      expect.objectContaining({
        step: stage,
        reason: 'hard violation rejected; restored last hard-safe checkpoint',
      }),
    );
  },
);

it('does not return an unsafe plan when no safe checkpoint exists', () => {
  const context = createContext(profile);
  const unsafe = planFixture();
  unsafe.templates[0].items = [];
  expect(() => retainLastHardSafe(unsafe, undefined, context, 'assemble')).toThrow(
    'No hard-safe generation checkpoint',
  );
  expect(() => retainLastHardSafe(unsafe, unsafe, context, 'final-return')).toThrow(
    'No hard-safe generation checkpoint',
  );
});

it('retains an independently reprovable environment draft without treating its warning as a hard violation', () => {
  const environmentProfile = baseProfile({
    birthYearMonth: '1956-06',
    population: {
      kind: 'older_adult',
      fallsAnswers: [false, false, false, false],
    },
    daysPerWeek: 3,
    place: 'outdoor',
    householdSupport: false,
    equipment: ['none'],
    constraints: { space: 'mat', quiet: true, noJump: true },
  });
  const context = createContext(environmentProfile);
  const plan = generatePlan(environmentProfile);
  const diagnostics = checkHard(plan, environmentProfile, context.gate, context.rules);
  const source = context.rules.get('older.template.balance_required').environment_exception;
  expect(plan.templates.length).toBeGreaterThan(0);
  expect(plan.quality?.status).toBe('environmentLimited');
  expect(diagnostics).toContainEqual(expect.objectContaining({ code: source.warning_code, severity: 'warning' }));
  expect(diagnostics.filter(issue => issue.severity === 'error')).toEqual([]);
  expect(retainLastHardSafe(plan, undefined, context, 'final-return')).toBe(plan);
  expect(applicableEnginePlan(plan, environmentProfile)).toBe(true);

  const supportedProfile = { ...environmentProfile, householdSupport: true };
  const supportedContext = createContext(supportedProfile);
  const safePlan = generatePlan(supportedProfile);
  const missingBalance = structuredClone(safePlan);
  for (const template of missingBalance.templates) {
    template.items = template.items.filter(
      item => supportedContext.rules.byExercise.get(item.exerciseId)?.primary_pattern !== 'balance',
    );
  }
  expect(checkHard(missingBalance, supportedProfile, supportedContext.gate, supportedContext.rules)).toContainEqual(
    expect.objectContaining({ code: 'balance_days', severity: 'error' }),
  );
  const restored = retainLastHardSafe(missingBalance, safePlan, supportedContext, 'improve');
  expect(restored.templates).toEqual(safePlan.templates);
  expect(
    checkHard(restored, supportedProfile, supportedContext.gate, supportedContext.rules).filter(
      issue => issue.severity === 'error',
    ),
  ).toEqual([]);
});
