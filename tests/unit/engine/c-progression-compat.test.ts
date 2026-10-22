import { independentStartTarget } from './reference/training-engine-start-target';
import { it, expect } from 'vitest';
import { progress } from '../../../src/engine/progression';
import { Rules } from '../../../src/engine/data';
import { fixtureProfile, planFixture } from './fixtures';
it('does not infer progression from an undated request or mutate the saved plan', () => {
  const p = { ...fixtureProfile, asOfDate: undefined },
    plan = planFixture(),
    before = structuredClone(plan),
    out = progress([], plan, p, new Rules(), { checkin: { poorSleepNights: 99, newOrWorseJointPain: true } });
  expect(out.noop).toBe(true);
  expect(out.value).toEqual(before);
  expect(plan).toEqual(before);
});
it('keeps saved prescriptions unchanged when medical gates block progression', () => {
  const p = { ...fixtureProfile, screening: { ...fixtureProfile.screening, symptoms: true } },
    plan = planFixture(),
    before = structuredClone(plan),
    out = progress([], plan, p, new Rules(), { checkin: { poorSleepNights: 99 } });
  expect(out.noop).toBe(true);
  expect(out.value).toEqual(before);
  expect(out.gates.some(g => g.status === 'blocked')).toBe(true);
  expect(plan).toEqual(before);
});
it.each(['2.0.0', '2.0.0-p0', 'existing', 'unknown'])(
  'preserves declared targets for %s instead of reverse deriving them from elapsed time',
  engineVersion => {
    const p = { ...fixtureProfile, goal: 'start_moving' as const },
      plan = planFixture();
    plan.meta.engineVersion = engineVersion;
    plan.templates[0].targetMinutes = 17;
    const before = structuredClone(plan),
      out = progress([], plan, p, new Rules());
    expect(out.value.templates[0].targetMinutes).toBe(17);
    expect(plan).toEqual(before);
    expect(out.trace.some(row => row.reason === 'unknown_engine_version_preserves_declared_target')).toBe(
      !engineVersion.startsWith('2.'),
    );
  },
);
it('rebuilds an explicitly V1 synthetic persisted target against the independent legacy source model', () => {
  const p = { ...fixtureProfile, goal: 'start_moving' as const, daysPerWeek: 1 },
    plan = planFixture();
  plan.meta.engineVersion = '1.0.0';
  plan.templates[0].targetMinutes = 17;
  const expected = independentStartTarget(plan.templates[0], p);
  expect(expected).toBeDefined();
  const before = structuredClone(plan),
    out = progress([], plan, p, new Rules());
  expect(out.value.templates[0].targetMinutes).toBe(expected);
  expect(plan).toEqual(before);
});
