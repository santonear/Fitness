import { expect, it } from 'vitest';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
import { Rules } from '../../../src/engine/data';
import { ownedEquipment, hasHouseholdSupport } from '../../../src/engine/equipment';
import { createContext, generatePlan } from '../../../src/engine/pipeline';
import { isHardEligible } from '../../../src/engine/candidates';
import { applicableEnginePlan, missingEnvironmentTypes } from '../../../src/engine/environment';
import { toEngineProfile, type EngineCoachProfile } from '../../../src/application/engine-profile';
const rules = new Rules();
const older = () =>
  baseProfile({
    ageYears: 70,
    birthYearMonth: '1956-06',
    population: {
      kind: 'older_adult',
      balanceCautious: true,
      fallsAnswers: [false, false, false, false],
    },
    daysPerWeek: 3,
  });
it.each(['home', 'mixed', 'gym'])('defaults %s to household support without enlarging mat space', place => {
  const p = {
      ...older(),
      place: place as 'home',
      constraints: { noJump: false, quiet: false, space: 'mat' as const },
    },
    ctx = createContext(p);
  expect(hasHouseholdSupport(p)).toBe(true);
  expect([...ownedEquipment(p)]).toEqual(expect.arrayContaining(['wall', 'chair', 'counter']));
  expect(rules.data.exercises.some(e => e.primary_pattern === 'balance' && isHardEligible(e, p, ctx.gate, ctx))).toBe(
    true,
  );
  expect(p.constraints.space).toBe('mat');
});
it('does not invent outdoor support or erase actual equipment when explicitly disabled', () => {
  expect(ownedEquipment({ ...older(), place: 'outdoor' }).has('wall')).toBe(false);
  expect(ownedEquipment({ ...older(), householdSupport: false }).has('chair')).toBe(false);
  expect(
    ownedEquipment({
      ...older(),
      householdSupport: false,
      equipment: ['wall'],
    }).has('wall'),
  ).toBe(true);
});
it('maps local profile defaults and explicit opt-out without inferring health answers', () => {
  const p = older(),
    coach: EngineCoachProfile = {
      goalText: '保持活动',
      weeklyTarget: 3,
      sessionMinutes: 30,
      scheduleOriginalText: '每周三次',
      place: 'home',
      equipment: ['none'],
      adultConfirmed: true,
      cautions: [],
      confirmedAt: '2026-10-16T00:00:00.000Z',
      population: p.population,
      screening: p.screening,
      healthStorageConsent: { acceptedAt: '2026-10-16T00:00:00.000Z' },
      constraints: { noJump: false, quiet: false, space: 'mat' },
    };
  expect(toEngineProfile(coach, { asOfDate: '2026-10-16', ageYears: 70 })?.householdSupport).toBe(true);
  expect(
    toEngineProfile({ ...coach, place: 'outdoor' }, { asOfDate: '2026-10-16', ageYears: 70 })?.householdSupport,
  ).toBe(false);
  expect(
    toEngineProfile({ ...coach, householdSupport: false }, { asOfDate: '2026-10-16', ageYears: 70 })?.householdSupport,
  ).toBe(false);
});
it('applies only proven environmental omissions and restores balance when support is available', () => {
  const p = { ...older(), place: 'outdoor' as const, householdSupport: false },
    plan = generatePlan(p);
  expect(plan.quality?.status).toBe('environmentLimited');
  expect(
    plan.quality?.issues.some(
      i =>
        i.code === rules.get('older.template.balance_required').environment_exception.warning_code &&
        i.severity === 'warning',
    ),
  ).toBe(true);
  expect(applicableEnginePlan(plan, p)).toBe(true);
  expect(plan.notices[0].code).toBe('engine.copy.environment_balance');
  const supported = { ...p, householdSupport: true },
    updated = generatePlan(supported);
  expect(updated.quality?.basis).not.toBe('environment_constraint');
  expect(updated.quality?.issues).toEqual([]);
  expect(
    updated.templates.filter(t => t.items.some(i => rules.byExercise.get(i.exerciseId)?.primary_pattern === 'balance')),
  ).toHaveLength(3);
  expect(applicableEnginePlan(updated, supported)).toBe(true);
  const ctx = createContext(p),
    extra = [
      ...(plan.quality?.issues ?? []),
      {
        code: 'duration',
        ruleId: 'duration.fit.tolerance',
        severity: 'error' as const,
        reason: 'real hard failure',
      },
    ];
  expect(missingEnvironmentTypes(plan, p, ctx.gate, rules, extra)).toEqual([]);
  expect(applicableEnginePlan({ ...plan, quality: { ...plan.quality!, issues: extra } }, p)).toBe(false);
});
