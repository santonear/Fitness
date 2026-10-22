import { expect, it } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { marginal, scorePlan } from '../../../src/engine/score';
import { fixtureProfile, planFixture } from './fixtures';
const rules = new Rules(),
  id = 'session.warmup.balance_older',
  profile = { ...fixtureProfile, birthYearMonth: '1956-06', population: { kind: 'older_adult' as const } };
function fixture(seconds: number, side: 'none' | 'explicit' | 'catalog' = 'none', sets = 1) {
  const plan = planFixture(),
    exercise = rules.data.exercises.find(
      e => e.primary_pattern === 'balance' && e.time.per_side === (side === 'catalog'),
    )!,
    item = plan.templates[0].items[0];
  item.exerciseId = exercise.id;
  item.sets = sets;
  item.target = { metricType: 'duration', durationSeconds: seconds };
  item.prescription = {
    ...item.prescription!,
    pattern: 'balance',
    block: 'warmup',
    ...(side === 'explicit' ? { perSide: true } : {}),
  };
  return plan;
}
function satisfaction(plan: ReturnType<typeof fixture>) {
  const row = scorePlan(plan, profile, rules).perRule.find(row => row.id === id);
  expect(row).toBeDefined();
  expect(row!.weight).toBe(1);
  return row!.satisfaction;
}
it.each([
  [59, 59 / 60],
  [60, 1],
  [120, 1],
  [121, 59 / 60],
])('scores %s actual work seconds against both source boundaries', (seconds, expected) =>
  expect(satisfaction(fixture(seconds))).toBeCloseTo(expected, 12),
);
it.each(['explicit', 'catalog'] as const)('counts both sides from %s per-side facts', side => {
  expect(satisfaction(fixture(30, side))).toBe(1);
  expect(satisfaction(fixture(29, side))).toBeCloseTo(58 / 60, 12);
});
it('counts sets as work without treating setup, overhead or rests as balance practice', () => {
  const plan = fixture(30, 'none', 2),
    item = plan.templates[0].items[0];
  item.prescription!.restSeconds = 120;
  item.prescription!.setupSeconds = 120;
  expect(satisfaction(plan)).toBe(1);
  item.sets = 1;
  expect(satisfaction(plan)).toBe(0.5);
});
it('does not fabricate completed practice from an unknown exercise or an absent timed target', () => {
  const unknown = fixture(60);
  unknown.templates[0].items[0].exerciseId = 'unknown-balance';
  expect(satisfaction(unknown)).toBe(0);
  const untimed = fixture(60);
  untimed.templates[0].items[0].target = { metricType: 'reps', reps: 30 };
  expect(satisfaction(untimed)).toBe(0);
});
it('retains source population and minimum session-duration applicability', () => {
  const plan = fixture(60);
  expect(scorePlan(plan, fixtureProfile, rules).perRule.some(row => row.id === id)).toBe(false);
  expect(scorePlan(plan, { ...profile, sessionMinutes: 19 }, rules).perRule.some(row => row.id === id)).toBe(false);
  expect(rules.byId.get(id)?.severity).toBe('target');
});
it('keeps the existing warmup marginal dependency equal to a fresh full score', () => {
  const plan = Object.freeze(fixture(29, 'catalog')),
    next = fixture(30, 'catalog'),
    change = {
      kind: 'replace' as const,
      templateId: plan.templates[0].id,
      itemIndex: 0,
      item: next.templates[0].items[0],
    };
  expect(marginal(plan, change, profile, rules)).toBeCloseTo(
    scorePlan(next, profile, rules).quality - scorePlan(plan, profile, rules).quality,
    12,
  );
});
it('honors source false only for warmup balance day credit, retaining formal balance and practice-time credit', () => {
  const data = structuredClone(rules.data);
  data.rules.find(rule => rule.id === id)!.value!.counts_toward_balance_days = false;
  const disabled = new Rules(data),
    plan = fixture(60),
    rowId = 'older.week.multicomponent';
  const value = (r: Rules) => scorePlan(plan, profile, r).perRule.find(row => row.id === rowId)!.satisfaction;
  expect(value(rules)).toBeGreaterThan(0);
  expect(value(disabled)).toBe(0);
  expect(scorePlan(plan, profile, disabled).perRule.find(row => row.id === id)!.satisfaction).toBe(1);
  plan.templates[0].items[0].prescription!.block = 'balance';
  expect(value(disabled)).toBe(value(rules));
  expect(value(disabled)).toBeGreaterThan(0);
  plan.templates[0].items[0].prescription!.block = 'cooldown';
  expect(value(disabled)).toBe(0);
  expect(value(rules)).toBe(0);
});
