import {
  independentElapsedAllocation,
  independentGoalShareIssues,
} from '../unit/engine/reference/training-engine-goal-share';
import { it, expect } from 'vitest';
import { Rules } from '../../src/engine/data';
import { elapsedAllocation, estimatedSeconds, weeklyElapsedAllocation } from '../../src/engine/fit/elapsed-time';
import { generatePlan, validatePlan } from '../../src/engine';
import type { EnginePlan } from '../../src/engine/contracts';
import type { Template, Item } from '../../src/engine/dose';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import { scorePlan } from '../../src/engine/score';
function healthTarget(p: EnginePlan) {
  const row = scorePlan(p, baseProfile({ daysPerWeek: 1 })).perRule.find(row => row.id === 'goal.params.health');
  expect(row).toBeDefined();
  return row!.satisfaction;
}
const r = new Rules(),
  strength = r.data.exercises.find(e => e.modality === 'strength' && e.metricType === 'reps' && !e.time.per_side)!,
  cardio = r.data.exercises.find(e => e.slug === 'walking')!,
  mobility = r.data.exercises.find(e => e.modality === 'mobility' && !e.time.per_side)!;
function item(e: typeof strength): Item {
  return {
    exerciseId: e.id,
    equipment: e.equipment_required[0],
    sets: 2,
    target:
      e.modality === 'strength' ? { metricType: 'reps', reps: 1 } : { metricType: 'duration', durationSeconds: 10 },
    prescription: {
      pattern: e.primary_pattern,
      block: e.modality === 'cardio' ? 'conditioning' : 'main',
      rir: [3, 4],
      restSeconds: 90,
      secondsPerRep: 3,
      structure: 'straight',
    },
  };
}
function template(items: Item[]): Template {
  return { id: 'allocation', name: 'fixture', estimatedMinutes: 10, items };
}
function plan(t: Template): EnginePlan {
  return {
    weeklyTarget: 1,
    sessionMinutes: 30,
    templates: [t],
    meta: { engineVersion: 'fixture', rulesVersion: r.data.rulesVersion, seed: 'allocation' },
    gates: [],
    notices: [],
    trace: [],
  };
}
it('accounts every second, including exclusive rest/setup/ramp, without changing estimated duration', () => {
  const a = item(strength);
  a.prescription!.warmupSeconds = 120;
  const b = item(cardio);
  b.prescription!.targetRpe = [4, 4];
  const c = item(mobility);
  c.prescription!.block = 'cooldown';
  const t = template([a, b, c]),
    v = elapsedAllocation(t, r);
  expect(v.total).toBe(estimatedSeconds(t, r));
  expect(v.resistance).toBe(estimatedSeconds(template([a]), r));
  expect(v.aerobic).toBe(20);
  expect(v.mobility).toBe(estimatedSeconds(template([c]), r));
  expect(v.resistance + v.aerobic + v.mobility + v.other + v.unallocated).toBe(v.total);
  expect(weeklyElapsedAllocation([t, t], r).total).toBe(v.total * 2);
});
it('retains cross-modality shared overhead in the total as explicitly unallocated', () => {
  const a = item(strength),
    b = item(cardio);
  for (const i of [a, b]) {
    i.prescription!.structure = 'superset';
    i.prescription!.groupId = 'mixed';
  }
  const t = template([a, b]),
    v = elapsedAllocation(t, r),
    rest = r.get('duration.rest.block').superset;
  expect(v.unallocated).toBe(
    r.get('duration.transition.setup').buffer_s + 2 * rest.between_exercises_s + rest.after_round_s,
  );
  expect(v.resistance + v.aerobic + v.unallocated).toBe(v.total);
  const issues = validatePlan(plan(t), baseProfile({ daysPerWeek: 1 })).filter(i =>
    i.code.startsWith('goal_time_share'),
  );
  expect(issues).toEqual([]);
  expect(v.unallocated).toBeGreaterThan(0);
  expect(healthTarget(plan(t))).toBeLessThan(1);
});
it('scores absent aerobic share from actual work even if displayed total duration is falsified', () => {
  const t = template([item(strength)]);
  t.estimatedMinutes = 1000;
  const p = plan(t),
    score = healthTarget(p);
  expect(independentElapsedAllocation(p).aerobic).toBe(0);
  expect(
    independentGoalShareIssues(p, baseProfile({ daysPerWeek: 1 })).some(i => i.reason.startsWith('aerobic:')),
  ).toBe(true);
  expect(score).toBeLessThan(1);
  t.estimatedMinutes = 1;
  t.estimatedSeconds = 1;
  expect(healthTarget(p)).toBe(score);
});
it('uses the independent source allocation formula without changing user days or inputs', () => {
  const p = baseProfile({ daysPerWeek: 3 }),
    before = JSON.stringify(p),
    result = generatePlan(p),
    entry = result.trace.find(
      t => t.ruleId === 'week.days.allocation' && t.reason === 'source_rotation_and_goal_allocation',
    )!;
  const goal = r.get('goal.params.health'),
    allocation = r.get('week.days.allocation');
  expect(goal.rt_sessions_week.default).toBe(2);
  expect(allocation.rt_days).toBe('min(days_available, goal.rt_sessions_week.max, phase_cap)');
  expect(entry.details?.rtDays).toBe(Math.min(p.daysPerWeek, goal.rt_sessions_week.max));
  expect(result.weeklyTarget).toBe(3);
  expect(result.templates).toHaveLength(3);
  expect(JSON.stringify(p)).toBe(before);
});
import { independentlyApplicableSessionTypes } from '../unit/engine/reference/training-engine-session-time';
function mixed() {
  const a = item(strength),
    b = item(cardio);
  for (const i of [a, b]) {
    i.prescription!.structure = 'superset';
    i.prescription!.groupId = 'mixed';
  }
  return [a, b];
}
function mixedExpected() {
  const rest = r.get('duration.rest.block').superset,
    overhead = r.get('duration.set.overhead').overhead_s_per_set;
  return {
    resistance: 2 * (3 + overhead) + strength.time.setup_s,
    aerobic: 2 * (10 + overhead) + cardio.time.setup_s,
    unallocated: r.get('duration.transition.setup').buffer_s + 2 * rest.between_exercises_s + rest.after_round_s,
  };
}
it('independently accounts dedicated work/rest/setup/ramp instead of trusting displayed estimates', () => {
  const a = item(strength);
  a.prescription!.warmupSeconds = 120;
  const expected =
    strength.time.setup_s +
    r.get('duration.transition.setup').buffer_s +
    2 * (3 + r.get('duration.set.overhead').overhead_s_per_set) +
    90 +
    120;
  const t = template([a]);
  t.estimatedMinutes = 9000;
  expect(elapsedAllocation(t, r)).toEqual({
    resistance: expected,
    aerobic: 0,
    mobility: 0,
    other: 0,
    unallocated: 0,
    total: expected,
  });
});
it('does not lose a mixed station or allocate shared time when the cardio member comes first', () => {
  const members = mixed(),
    expected = mixedExpected(),
    total = expected.resistance + expected.aerobic + expected.unallocated;
  for (const items of [members, [...members].reverse()])
    expect(elapsedAllocation(template(items), r)).toEqual({ ...expected, mobility: 0, other: 0, total });
});
it('rejects joint minima that individually overlap the same shared seconds', () => {
  const members = mixed(),
    expected = mixedExpected(),
    range = r.get('goal.params.health').time_share,
    base = expected.resistance + expected.aerobic + expected.unallocated;
  const other = r.data.exercises.find(
    e => e.primary_pattern === 'balance' && e.metricType === 'duration' && !e.time.per_side,
  )!;
  expect(other).toBeDefined();
  const overhead = r.get('duration.set.overhead').overhead_s_per_set;
  let chosen = 0;
  for (let seconds = 1; seconds <= 1000; seconds++) {
    const total = base + seconds + overhead,
      individuallyPossible = ['resistance', 'aerobic'].every(
        key =>
          (expected[key as 'resistance' | 'aerobic'] + expected.unallocated) / total >= range[key][0] &&
          expected[key as 'resistance' | 'aerobic'] / total <= range[key][1],
      ),
      deficit = ['resistance', 'aerobic'].reduce(
        (sum, key) => sum + Math.max(0, range[key][0] * total - expected[key as 'resistance' | 'aerobic']),
        0,
      );
    if (individuallyPossible && deficit > expected.unallocated) {
      chosen = seconds;
      break;
    }
  }
  expect(chosen).toBeGreaterThan(0);
  const b = item(other);
  b.sets = 1;
  b.target = { metricType: 'duration', durationSeconds: chosen };
  b.prescription!.block = 'warmup';
  const issues = validatePlan(plan(template([...members, b])), baseProfile({ daysPerWeek: 1 })).filter(i =>
    i.code.startsWith('goal_time_share'),
  );
  expect(issues.some(i => i.code === 'goal_time_share' && i.severity === 'error')).toBe(false);
  expect(issues).toEqual([]);
  expect(healthTarget(plan(template([...members, b])))).toBeLessThan(1);
  const independent = independentGoalShareIssues(plan(template([...members, b])), baseProfile({ daysPerWeek: 1 }));
  expect(independent.some(i => i.code === 'external_goal_time_share_joint')).toBe(true);
  expect(independent.some(i => i.code === 'external_goal_time_share')).toBe(false);
});
it('counts light warm/cool cardio as elapsed aerobic share without treating it as moderate exercise', () => {
  const light = item(cardio);
  light.sets = 1;
  light.target = { metricType: 'duration', durationSeconds: 100 };
  light.prescription!.block = 'warmup';
  const lightMax = r.get('aerobic.intensity.rpe_scale').light_max;
  light.prescription!.targetRpe = [lightMax, lightMax];
  const t = template([light]),
    before = structuredClone(t);
  expect(elapsedAllocation(t, r).aerobic).toBe(100 + r.get('duration.set.overhead').overhead_s_per_set);
  expect(independentlyApplicableSessionTypes(t)).toEqual([]);
  expect(lightMax).toBeLessThan(r.get('aerobic.intensity.rpe_scale').moderate[0]);
  expect(t).toEqual(before);
});

it('uses actual weekly total for both lower and upper source share violations', () => {
  const range = r.get('goal.params.health').time_share;
  for (const aerobicSeconds of [1, 10000]) {
    const a = item(strength),
      b = item(cardio);
    b.sets = 1;
    b.target = { metricType: 'duration', durationSeconds: aerobicSeconds };
    const resistance =
        strength.time.setup_s +
        r.get('duration.transition.setup').buffer_s +
        2 * (3 + r.get('duration.set.overhead').overhead_s_per_set) +
        90,
      total = resistance + aerobicSeconds;
    const expected = ['resistance', 'aerobic'].filter(key => {
      const share = (key === 'resistance' ? resistance : aerobicSeconds) / total;
      return share < range[key][0] || share > range[key][1];
    });
    expect(expected).toHaveLength(2);
    const t = template([a, b]);
    t.estimatedMinutes = 1;
    const issues = independentGoalShareIssues(plan(t), baseProfile({ daysPerWeek: 1 })).filter(
      i => i.code === 'external_goal_time_share',
    );
    expect(issues.map(i => i.reason.split(':')[0]).sort()).toEqual(expected.sort());
    for (const issue of issues) expect(issue.reason).toContain(`total:${total};unallocated:0`);
    expect(healthTarget(plan(t))).toBeLessThan(1);
  }
});

it('the external checker independently preserves mixed station order, total denominator and unallocated seconds', () => {
  const expected = mixedExpected();
  for (const members of [mixed(), mixed().reverse()]) {
    const p = plan(template(members));
    p.templates[0].estimatedMinutes = 9999;
    expect(independentElapsedAllocation(p)).toEqual({
      ...expected,
      mobility: 0,
      other: 0,
      total: expected.resistance + expected.aerobic + expected.unallocated,
    });
    expect(independentGoalShareIssues(p, baseProfile({ daysPerWeek: 1 }))).toEqual([]);
  }
});
it('external source share violations survive false metadata and cannot be hidden by light aerobic warmup', () => {
  const t = template([item(strength)]),
    p = plan(t),
    profile = baseProfile({ daysPerWeek: 1 });
  const before = independentGoalShareIssues(p, profile);
  expect(before.some(i => i.reason.startsWith('aerobic:'))).toBe(true);
  t.estimatedMinutes = 9000;
  t.estimatedSeconds = 900000;
  expect(independentGoalShareIssues(p, profile)).toEqual(before);
  const light = item(cardio);
  light.sets = 1;
  light.target = { metricType: 'duration', durationSeconds: 1 };
  light.prescription!.block = 'warmup';
  const max = r.get('aerobic.intensity.rpe_scale').light_max;
  light.prescription!.targetRpe = [max, max];
  t.items.push(light);
  expect(independentlyApplicableSessionTypes(t)).toEqual([]);
  expect(independentElapsedAllocation(p).aerobic).toBe(1 + r.get('duration.set.overhead').overhead_s_per_set);
  expect(independentGoalShareIssues(p, profile).some(i => i.reason.startsWith('aerobic:'))).toBe(true);
});
it('the external checker uses total weekly elapsed time and keeps source phase-one untargeted exercise exempt', () => {
  const t = template([item(strength)]),
    p = plan(t);
  p.templates.push(structuredClone(t));
  expect(independentElapsedAllocation(p).total).toBe(independentElapsedAllocation(plan(t)).total * 2);
  expect(
    independentGoalShareIssues(
      p,
      baseProfile({ population: { kind: 'postpartum', weeksSinceBirth: 2, delivery: 'vaginal', cleared: false } }),
    ),
  ).toEqual([]);
});
