import { expect, it } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { marginal, scorePlan } from '../../../src/engine/score';
import { fixtureProfile, planFixture } from './fixtures';
const profile = { ...fixtureProfile, goal: 'start_moving' as const },
  rules = new Rules();
/** Fractional seconds expose reassociation: sum(seconds / 60) must not become sum(seconds) / 60. */
function fixture() {
  const plan = planFixture(),
    seed = plan.templates[0];
  plan.templates = [1.1, 2.2, 3.3].map((seconds, index) => {
    const template = structuredClone(seed);
    template.id = `ordered-${index}`;
    template.items[0].target = { metricType: 'duration', durationSeconds: seconds };
    template.items[0].prescription!.targetRpe = [5, 5];
    return template;
  });
  return plan;
}
function aerobic(plan: ReturnType<typeof fixture>) {
  return scorePlan(plan, profile, rules).perRule.find(row => row.id === 'aerobic.target.weekly')!.satisfaction;
}
it('preserves the original per-session floating-point addition order', () => {
  const plan = fixture(),
    minutes = 1.1 / 60 + 2.2 / 60 + 3.3 / 60,
    target = rules.get('aerobic.target.weekly').moderate_equiv_min_week;
  expect(aerobic(plan)).toBe(minutes / target);
});
it.each([0, 1, 2])('keeps exact fresh-score delta when changing session %s in a frozen baseline', index => {
  const plan = Object.freeze(fixture()),
    next = structuredClone(plan),
    item = structuredClone(plan.templates[index].items[0]);
  item.target = { metricType: 'duration', durationSeconds: 4.7 };
  next.templates[index].items[0] = item;
  const change = { kind: 'replace' as const, templateId: plan.templates[index].id, itemIndex: 0, item };
  const expected = scorePlan(next, profile, rules).quality - scorePlan(plan, profile, rules).quality;
  expect(marginal(plan, change, profile, rules)).toBe(expected);
  expect(marginal(plan, change, profile, rules)).toBe(expected);
});
it('does not retain aggregate state across mutable public plan and rule edits', () => {
  const plan = fixture(),
    r = new Rules(structuredClone(rules.data)),
    target = r.get('aerobic.target.weekly').moderate_equiv_min_week;
  scorePlan(plan, profile, r);
  plan.templates[1].items[0].target = { metricType: 'duration', durationSeconds: 4.7 };
  r.get('aerobic.target.weekly').moderate_equiv_min_week = target * 2;
  const row = scorePlan(plan, profile, r).perRule.find(row => row.id === 'aerobic.target.weekly')!;
  expect(row.satisfaction).toBe((1.1 / 60 + 4.7 / 60 + 3.3 / 60) / (target * 2));
  expect(aerobic(fixture())).toBe((1.1 / 60 + 2.2 / 60 + 3.3 / 60) / target);
});
