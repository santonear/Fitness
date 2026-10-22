import { expect, it } from 'vitest';
import { generatePlan, validatePlan, nextTargets } from '../../src/engine';
import { engineProfileSchema, type EnginePlan } from '../../src/engine/contracts';
import { Rules } from '../../src/engine/data';
import { estimateSeconds, fitDuration } from '../../src/engine/fit';
import { createContext } from '../../src/engine/pipeline';
import { runGates } from '../../src/engine/gates';
import { scorePlan } from '../../src/engine/score';
import { buildWeek } from '../../src/engine/structure';
import { safety } from '../../src/engine/gates/strength-scoring';
import { prescribe } from '../../src/engine/dose';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import profiles from '../unit/engine/fixtures/v1-surplus-inputs.json';
import { independentElapsedAllocation } from '../unit/engine/reference/training-engine-goal-share';
import { independentlyPossibleIds } from '../../tools/eval/training-engine-quality';
const r = new Rules(),
  legacy = engineProfileSchema.parse(profiles.find(row => row.index === 18)!.profile);
// New synthetic answers, never migration defaults for the retained legacy input.
const p = baseProfile({ ...structuredClone(legacy), screening: baseProfile().screening }),
  plan = generatePlan(p);
const working = (copy: EnginePlan) =>
  copy.templates.flatMap(t => t.items).filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? ''));
const targets = (copy: EnginePlan) => copy.templates.map(t => t.targetMinutes);
const aerobicScore = (copy: EnginePlan) =>
  scorePlan(copy, p, r).perRule.find(row => row.id === 'aerobic.target.weekly')!.satisfaction;
// Source arithmetic stays independent of production score/credit helpers.
function independentGoalSatisfaction(copy: EnginePlan) {
  const goal = r.get('goal.params.start_moving'),
    fractional = r.get('dose.volume.fractional'),
    map = r.get('dose.muscle_groups').catalog_map,
    weekly = new Map<string, number>();
  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length,
    clamp = (n: number) => Math.max(0, Math.min(1, n)),
    interval = (n: number, lo: number, hi: number) =>
      n < lo ? clamp(n / lo) : n > hi ? clamp(1 - (n - hi) / Math.max(lo, hi - lo)) : 1;
  const work = working(copy),
    rt = copy.templates.filter(t => t.items.some(i => ['main', 'accessory'].includes(i.prescription?.block ?? '')));
  for (const i of work) {
    const e = r.byExercise.get(i.exerciseId)!;
    if (fractional.excluded_modalities.includes(e.modality) || fractional.excluded_patterns.includes(e.primary_pattern))
      continue;
    const credits: Record<string, number> = {};
    for (const [muscles, weight] of [
      [e.primaryMuscles ?? [], fractional.per_set_credit.primaryMuscles],
      [e.secondaryMuscles ?? [], fractional.per_set_credit.secondaryMuscles],
    ] as [string[], number][])
      for (const m of muscles) if (map[m]) credits[map[m]] = Math.max(credits[map[m]] ?? 0, weight);
    if (!Object.keys(credits).length)
      Object.assign(credits, fractional.pattern_fallback_if_no_muscles[e.primary_pattern] ?? {});
    const rir = i.prescription!.rir[0],
      effort =
        rir <= 3
          ? fractional.set_effort_multiplier.rir_0_to_3
          : rir === 4
            ? fractional.set_effort_multiplier.rir_4
            : fractional.set_effort_multiplier.rir_5_plus;
    for (const [g, c] of Object.entries(credits)) weekly.set(g, (weekly.get(g) ?? 0) + c * effort * i.sets);
  }
  const total = independentElapsedAllocation(copy).total,
    resistance = independentElapsedAllocation({
      templates: rt.map(t => ({
        ...t,
        items: t.items.filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? '')),
      })),
    }).total;
  let aerobicSeconds = 0,
    mvpa = 0;
  for (const i of copy.templates.flatMap(t => t.items)) {
    const e = r.byExercise.get(i.exerciseId)!;
    if (i.prescription?.block !== 'conditioning' || e.modality !== 'cardio' || !('durationSeconds' in i.target))
      continue;
    const seconds =
        i.sets *
        i.target.durationSeconds *
        (i.prescription?.perSide || e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1),
      rpe = i.prescription.targetRpe?.[0] ?? 0;
    aerobicSeconds += seconds;
    mvpa +=
      (seconds / 60) *
      (rpe >= r.get('aerobic.intensity.rpe_scale').vigorous[0]
        ? r.get('aerobic.target.weekly').vigorous_multiplier
        : rpe >= r.get('aerobic.intensity.rpe_scale').moderate[0]
          ? 1
          : 0);
  }
  return mean([
    interval(rt.length, goal.rt_sessions_week.min, goal.rt_sessions_week.max),
    interval(resistance / total, ...(goal.time_share.resistance as [number, number])),
    interval(aerobicSeconds / total, ...(goal.time_share.aerobic as [number, number])),
    mean(
      r
        .get('dose.muscle_groups')
        .target_groups.map((g: string) =>
          interval(weekly.get(g) ?? 0, goal.sets_per_muscle_week.min, goal.sets_per_muscle_week.max),
        ),
    ),
    mean(
      work.map(i =>
        mean([
          interval(i.prescription!.rir[0], goal.rir.min, goal.rir.max),
          ...('reps' in i.target ? [interval(i.target.reps, goal.reps.min, goal.reps.max)] : []),
        ]),
      ),
    ),
    clamp(mvpa / goal.aerobic_moderate_equiv_min_week.target),
  ]);
}
it('independently measures fractional weekly volume, real shares, rep and effort target deficits', () => {
  const row = scorePlan(plan, p, r).perRule.find(row => row.id === 'goal.params.start_moving')!;
  expect(row.satisfaction).toBeCloseTo(independentGoalSatisfaction(plan), 12);
  const missing = structuredClone(plan);
  for (const t of missing.templates)
    t.items = t.items.filter(i => r.byExercise.get(i.exerciseId)?.primary_pattern !== 'squat');
  expect(scorePlan(missing, p, r).perRule.find(row => row.id === 'goal.params.start_moving')!.satisfaction).toBeCloseTo(
    independentGoalSatisfaction(missing),
    12,
  );
});
it('keeps the original incomplete screening blocked without inventing negative answers', () => {
  const before = structuredClone(legacy),
    blocked = generatePlan(legacy);
  expect(runGates(legacy, r).status).toBe('blocked');
  expect(blocked.templates).toEqual([]);
  expect(legacy).toEqual(before);
  expect(legacy.screening.cmrSymptoms).toBeUndefined();
});
it('preserves available days and declared V2 targets with independent actual timing', () => {
  expect(p.goal).toBe('start_moving');
  expect(p.sessionMinutes).toBe(80);
  expect(plan.sessionMinutes).toBe(80);
  expect(plan.templates).toHaveLength(p.daysPerWeek);
  for (const t of plan.templates) {
    expect(t.targetMinutes).toBe(p.sessionMinutes);
    expect(estimateSeconds(t, r)).toBe(independentElapsedAllocation({ templates: [t] }).total);
  }
  expect(validatePlan(plan, p).filter(i => i.severity === 'error')).toEqual([]);
});
it('does not derive stored targets from conditioning, arbitrary rest, cooldown holds or displayed time', () => {
  const copy = structuredClone(plan),
    saved = targets(copy);
  for (const t of copy.templates) {
    t.estimatedMinutes = 1;
    t.estimatedSeconds = 99999;
    for (const i of t.items) {
      if ('durationSeconds' in i.target && !['main', 'accessory', 'balance'].includes(i.prescription?.block ?? ''))
        i.target.durationSeconds = 1;
      if (i.prescription) i.prescription.restSeconds = 999;
    }
  }
  expect(targets(copy)).toEqual(saved);
  expect(independentElapsedAllocation(copy).total).not.toBe(independentElapsedAllocation(plan).total);
  copy.templates[0].targetMinutes = 1;
  expect(validatePlan(copy, p).some(i => i.code === 'declared_target_invalid')).toBe(true);
});
it.each(['light', 'missing_rpe', 'zero_actual'] as const)(
  'credits actual explicit moderate work rather than %s or claimed effort metadata',
  mode => {
    const bad = structuredClone(plan);
    for (const i of bad.templates.flatMap(t => t.items))
      if (i.prescription && r.byExercise.get(i.exerciseId)?.modality === 'cardio') {
        if (mode === 'light')
          i.prescription.targetRpe = [
            r.get('aerobic.intensity.rpe_scale').scale[0],
            r.get('aerobic.intensity.rpe_scale').light_max,
          ];
        if (mode === 'missing_rpe') delete i.prescription.targetRpe;
        if (mode === 'zero_actual' && 'durationSeconds' in i.target) i.target.durationSeconds = 0;
        i.prescription.rir = [0, 0];
      }
    expect(aerobicScore(plan)).toBeGreaterThan(0);
    expect(aerobicScore(bad)).toBe(0);
    expect(targets(bad)).toEqual(targets(plan));
    if (mode === 'zero_actual') expect(validatePlan(bad, p).some(i => i.severity === 'error')).toBe(true);
  },
);
it('keeps weekly MVPA credit independent of how the same real work is distributed', () => {
  const copy = structuredClone(plan),
    items = copy.templates
      .flatMap(t => t.items)
      .filter(
        i =>
          i.prescription?.block === 'conditioning' &&
          r.byExercise.get(i.exerciseId)?.modality === 'cardio' &&
          'durationSeconds' in i.target &&
          (i.prescription.targetRpe?.[0] ?? 0) >= r.get('aerobic.intensity.rpe_scale').moderate[0],
      );
  expect(items.length).toBeGreaterThan(1);
  const total = items.reduce(
    (n, i) =>
      n +
      ('durationSeconds' in i.target
        ? i.sets *
          i.target.durationSeconds *
          (i.prescription?.perSide || r.byExercise.get(i.exerciseId)!.time.per_side
            ? r.get('session.time.model').per_side_multiplier
            : 1)
        : 0),
    0,
  );
  for (const i of items) i.target = { metricType: 'duration', durationSeconds: 0 };
  items[0].sets = 1;
  items[0].prescription!.perSide = false;
  items[0].target = { metricType: 'duration', durationSeconds: total };
  expect(aerobicScore(copy)).toBe(aerobicScore(plan));
  expect(validatePlan(copy, p).some(i => i.code === 'duration_tolerance')).toBe(true);
});
it('detects vigorous intensity above the declared start-moving source ceiling without extra credit masking it', () => {
  const copy = structuredClone(plan),
    i = copy.templates.flatMap(t => t.items).find(i => i.prescription?.block === 'conditioning')!,
    vigorous = r.get('aerobic.intensity.rpe_scale').vigorous;
  i.prescription!.targetRpe = [vigorous[0], vigorous[1]];
  expect(i.prescription!.targetRpe![1]).toBeGreaterThan(
    r.get('aerobic.intensity.rpe_scale')[r.get('goal.params.start_moving').max_intensity][1],
  );
  expect(targets(copy)).toEqual(targets(plan));
});
it('rejects actual excessive working sets despite a valid saved target', () => {
  const copy = structuredClone(plan);
  working(copy)[0].sets = 999;
  expect(validatePlan(copy, p).some(i => i.code === 'exercise_set_cap')).toBe(true);
  expect(targets(copy)).toEqual(targets(plan));
});
it('fits from actual work without mutating the input profile or rebuilding its declared target', () => {
  const input = { ...structuredClone(plan.templates[0]), slots: [] },
    before = structuredClone(input),
    profileBefore = structuredClone(p);
  for (const i of input.items)
    if (['main', 'accessory'].includes(i.prescription?.block ?? '')) i.prescription!.restSeconds = 600;
  const inflated = structuredClone(input),
    next = fitDuration(input, input.targetMinutes!, createContext(p, 0, r));
  expect(input).toEqual(inflated);
  expect(p).toEqual(profileBefore);
  expect(next.targetMinutes).toBe(before.targetMinutes);
  expect(estimateSeconds(next, r)).toBeLessThan(estimateSeconds(input, r));
  expect(next.estimatedSeconds).toBe(estimateSeconds(next, r));
});
it('keeps legal rep changes in actual elapsed work rather than reconstructing targets and rejects 999 reps', () => {
  const low = structuredClone(plan),
    high = structuredClone(plan),
    bounds = r.get('goal.params.start_moving').reps;
  for (const [copy, reps] of [
    [low, bounds.min],
    [high, bounds.max],
  ] as const)
    for (const i of working(copy)) if ('reps' in i.target) i.target.reps = reps;
  expect(targets(high)).toEqual(targets(low));
  expect(independentElapsedAllocation(high).total).toBeGreaterThan(independentElapsedAllocation(low).total);
  const bad = structuredClone(plan),
    i = working(bad).find(i => 'reps' in i.target)!;
  i.target = { metricType: 'reps', reps: 999 };
  expect(validatePlan(bad, p).some(i => i.code === 'reps_bounds')).toBe(true);
});
it('preserves missing targets and explicitly saved targets through progression without reverse engineering work duration', () => {
  const copy = structuredClone(plan);
  delete copy.templates[0].targetMinutes;
  const before = structuredClone(copy),
    next = nextTargets([], copy, p);
  expect(copy).toEqual(before);
  expect(next.value.templates[0].targetMinutes).toBeUndefined();
  expect(next.value.templates.slice(1).map(t => t.targetMinutes)).toEqual(targets(copy).slice(1));
});
it('accepts source hold bounds as dose facts and rejects 999 seconds without normalizing the target', () => {
  const e = r.data.exercises.find(
      e => e.modality === 'isometric' && e.primary_pattern !== 'balance' && e.use.includes('main'),
    )!,
    bounds = r.get('dose.isometric')[p.level].hold_s,
    t = structuredClone(plan.templates[0]),
    item = prescribe(e, p, r, safety(p, r), 'main', r.get('goal.params.start_moving').sets_per_exercise.max);
  t.items = [item];
  const copy = { ...structuredClone(plan), templates: [t] };
  for (const hold of bounds) {
    item.target = { metricType: 'duration', durationSeconds: hold };
    expect(validatePlan(copy, p).some(i => i.code === 'isometric_hold_bounds')).toBe(false);
    expect(t.targetMinutes).toBe(plan.templates[0].targetMinutes);
  }
  item.target = { metricType: 'duration', durationSeconds: 999 };
  expect(validatePlan(copy, p).some(i => i.code === 'isometric_hold_bounds')).toBe(true);
});
it('allocates resistance days from source maximum and phase cap rather than the default count', () => {
  for (const daysPerWeek of [1, 2, 5]) {
    const profile = { ...p, daysPerWeek },
      week = buildWeek(profile, runGates(profile, r), r),
      goal = r.get('goal.params.start_moving'),
      cap = r.get('progression.new.week_caps').week_3_4.rt_sessions_max,
      expected = Math.min(daysPerWeek, goal.rt_sessions_week.max, cap);
    expect(week.days.filter(day => !['aerobic', 'mobility'].includes(day.kind))).toHaveLength(expected);
    expect(week.days).toHaveLength(daysPerWeek);
  }
});
it('verifies the constrained pool, actual source doses and deterministic output without fabricating weekly floor success', () => {
  const before = structuredClone(p),
    possible = new Set(independentlyPossibleIds(p)),
    carry = r.get('balance.week.carry_ground');
  expect(r.data.exercises.filter(e => possible.has(e.id) && carry.patterns.includes(e.primary_pattern))).toEqual([]);
  const goal = r.get('goal.params.start_moving');
  for (const t of plan.templates)
    for (const i of t.items) {
      const e = r.byExercise.get(i.exerciseId)!;
      expect(possible.has(e.id), e.id).toBe(true);
      if (['main', 'accessory'].includes(i.prescription?.block ?? '')) {
        expect(i.sets).toBeGreaterThanOrEqual(goal.sets_per_exercise.min);
        expect(Number.isInteger(i.sets)).toBe(true);
        if ('reps' in i.target) {
          expect(i.target.reps).toBeGreaterThanOrEqual(goal.reps.min);
          expect(i.target.reps).toBeLessThanOrEqual(goal.reps.max);
        }
      }
      if (e.mobility_type === 'static' && 'durationSeconds' in i.target) {
        const range = r.get('dose.stretch').hold_s.range;
        expect(i.target.durationSeconds).toBeGreaterThanOrEqual(Math.max(range[0], e.stretch_hold_s?.[0] ?? range[0]));
        expect(i.target.durationSeconds).toBeLessThanOrEqual(Math.min(range[1], e.stretch_hold_s?.[1] ?? range[1]));
        expect(i.sets).toBeLessThanOrEqual(r.get('dose.stretch').reps_per_muscle[1]);
      }
    }
  const goalRow = scorePlan(plan, p, r).perRule.find(row => row.id === 'goal.params.start_moving')!;
  expect(goalRow.satisfaction).toBeGreaterThan(0);
  expect(goalRow.satisfaction).toBeLessThan(1);
  const outsideDefault = working(plan).filter(i => i.sets > goal.sets_per_exercise.max);
  expect(outsideDefault.length).toBeGreaterThan(0);
  expect(validatePlan(plan, p).some(i => i.code === 'exercise_set_cap')).toBe(false);
  expect(generatePlan(p)).toEqual(plan);
  expect(p).toEqual(before);
});
