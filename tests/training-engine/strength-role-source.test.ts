import { expect, it } from 'vitest';
import { generatePlan, validatePlan } from '../../src/engine';
import { Rules } from '../../src/engine/data';
import { scorePlan } from '../../src/engine/score';
import type { EnginePlan } from '../../src/engine/contracts';
import { substituteItem } from '../../src/engine/operations';
import { ensureCooldown } from '../../src/engine/progression/legacy-cooldown';
import { prescribe } from '../../src/engine/dose';
import { safety } from '../../src/engine/gates/strength-scoring';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import {
  independentStrengthIssues,
  independentStrengthRoles,
  independentActualStrengthRole,
} from '../unit/engine/reference/training-engine-strength-role';
import { independentElapsedAllocation } from '../unit/engine/reference/training-engine-goal-share';
import {
  independentCooldownIssues,
  independentlyProvedShortCooldown,
} from '../unit/engine/reference/training-engine-cooldown';
const r = new Rules(),
  p = baseProfile({ goal: 'strength', trainingAgeWeeks: 52, daysPerWeek: 2 }),
  source = generatePlan(p),
  goal = r.get('goal.params.strength');
function scored(plan: EnginePlan, profile = p, id = 'goal.params.strength') {
  const row = scorePlan(plan, profile, r).perRule.find(row => row.id === id);
  expect(row).toBeDefined();
  return row!.satisfaction;
}
function addCompleteStretches(plan: EnginePlan) {
  const t = plan.templates[0],
    map = r.get('dose.muscle_groups').catalog_map,
    groups = new Set(
      t.items
        .filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? ''))
        .flatMap(i => r.byExercise.get(i.exerciseId)?.primaryMuscles ?? [])
        .map(m => map[m])
        .filter(Boolean),
    );
  for (const group of groups) {
    const e = r.data.exercises.find(e => e.mobility_type === 'static' && e.stretch_targets?.includes(group));
    if (!e) continue;
    t.items.push({
      exerciseId: e.id,
      equipment: e.equipment_required[0],
      sets: 2,
      target: { metricType: 'duration', durationSeconds: 30 },
      prescription: { pattern: e.primary_pattern, block: 'cooldown', rir: [4, 4], restSeconds: 0 },
    });
  }
}
function fixture() {
  // Hand-built source-role counterexamples never depend on generated accessory retention.
  const exercises = ['squat', 'push_horizontal', 'hinge'].map(pattern =>
    r.data.exercises.find(
      e =>
        e.modality === 'strength' &&
        e.metricType === 'reps' &&
        e.primary_pattern === pattern &&
        e.equipment_required.every(k => k === 'none') &&
        e.difficulty < 4,
    )!,
  );
  const plan: EnginePlan = {
    weeklyTarget: 2,
    sessionMinutes: 30,
    templates: [
      {
        id: 'roles',
        name: 'Roles',
        estimatedMinutes: 30,
        items: exercises.map((e, n) => ({
          exerciseId: e.id,
          equipment: 'none',
          sets: 2,
          target: { metricType: 'reps', reps: n < 2 ? goal.main_lift.reps[1] : goal.accessory.reps[0] },
          prescription: {
            pattern: e.primary_pattern,
            block: 'main',
            sourcePosition: `main_${n + 1}`,
            goalRole: n < 2 ? 'main' : 'accessory',
            rir: [3, 4],
            restSeconds: 120,
            structure: 'straight',
          },
        })),
      },
    ],
    meta: { engineVersion: 'fixture', rulesVersion: r.data.rulesVersion, seed: 'roles' },
    gates: [],
    notices: [],
    trace: [],
  };
  const t = plan.templates[0],
    work = t.items;
  expect(work).toHaveLength(3);
  return { plan, t, work };
}
it('keeps strength2 limited only by real frequency while independently checking role doses, elapsed share and cold cap', () => {
  expect(r.byId.get('goal.params.strength')?.severity).toBe('target');
  expect(source.quality?.issues).toEqual([]);
  expect(source.gates.some(g => g.status === 'blocked')).toBe(false);
  expect(validatePlan(source, p).filter(i => i.severity === 'error')).toEqual([]);
  expect(scored(source)).toBeLessThan(1);
  const { plan, work } = fixture();
  expect(independentStrengthIssues(plan, p)).toEqual([]);
  expect([...independentStrengthRoles(work).values()]).toEqual(['main', 'main', 'accessory']);
  expect(work[2].prescription).toMatchObject({ block: 'main', sourcePosition: 'main_3', goalRole: 'accessory' });
  expect(work[2].target).toMatchObject({ reps: goal.accessory.reps[0] });
  expect(independentElapsedAllocation(plan).resistance).toBeGreaterThan(0);
});
it('rejects three actual main roles instead of accepting the source container main count', () => {
  const { plan, work } = fixture(),
    before = structuredClone(plan);
  for (const i of work) i.prescription!.goalRole = 'main';
  expect(independentStrengthIssues(plan, p).some(i => i.reason === 'actual_main_count_outside_source')).toBe(true);
  expect(scored(plan)).toBeLessThan(scored(before));
});
it.each(['role_only', 'role_and_block'] as const)(
  'does not permit auxiliary reclassification without real auxiliary dose: %s',
  mode => {
    const { plan, work } = fixture(),
      i = work[1];
    i.prescription!.goalRole = 'accessory';
    if (mode === 'role_and_block') i.prescription!.block = 'accessory';
    i.target = { metricType: 'reps', reps: goal.main_lift.reps[1] };
    expect(independentStrengthIssues(plan, p).some(i => i.reason === 'actual_reps_outside_source_role')).toBe(true);
    const repaired = structuredClone(plan);
    repaired.templates[0].items[1].target = { metricType: 'reps', reps: goal.accessory.reps[0] };
    expect(scored(plan)).toBeLessThan(scored(repaired));
    expect(i.prescription!.sourcePosition).toBe('main_2');
  },
);
it('requires the authored main prefix even if the later lift is relabelled and renamed', () => {
  const { plan, t, work } = fixture(),
    before = structuredClone(plan);
  work[0].prescription!.goalRole = 'accessory';
  work[1].prescription!.goalRole = 'main';
  t.name = 'M1';
  expect(independentStrengthRoles(t.items).get(work[0])).toBe('main');
  expect(independentStrengthIssues(plan, p).some(i => i.reason === 'source_prefix_role_mismatch')).toBe(true);
  expect(scored(plan)).toBeLessThan(scored(before));
});
it('does not let legacy omission or a block-only demotion silently convert source main_3 to a legal accessory', () => {
  const { plan, work } = fixture(),
    before = structuredClone(plan);
  for (const i of work) delete i.prescription!.goalRole;
  work[2].prescription!.block = 'accessory';
  expect(independentActualStrengthRole(work[2])).toBe('main');
  expect(independentStrengthIssues(plan, p).some(i => i.reason === 'actual_main_count_outside_source')).toBe(true);
  expect(scored(plan)).toBeLessThan(scored(before));
});
it('preserves the source container and position while an accepted auxiliary substitution receives actual auxiliary dose', () => {
  const { work } = fixture(),
    old = work.find(item => item.prescription?.goalRole === 'accessory')!;
  expect(old).toBeDefined();
  expect(old.prescription?.sourcePosition).toMatch(/^main_\d+$/);
  expect(old.prescription?.block).toBe('main');
  if ('reps' in old.target) {
    expect(old.target.reps).toBeGreaterThanOrEqual(goal.accessory.reps[0]);
    expect(old.target.reps).toBeLessThanOrEqual(goal.accessory.reps[1]);
  }
  const next = substituteItem(old, p, 'dislike', r).value as typeof old;
  expect(next.exerciseId).not.toBe(old.exerciseId);
  expect(next.prescription).toMatchObject({
    block: old.prescription!.block,
    sourcePosition: old.prescription!.sourcePosition,
    goalRole: 'accessory',
  });
  if ('reps' in next.target) {
    expect(next.target.reps).toBeGreaterThanOrEqual(goal.accessory.reps[0]);
    expect(next.target.reps).toBeLessThanOrEqual(goal.accessory.reps[1]);
  }
});
it('proves actual shortness independently and does not let auxiliary labels, metadata or a fabricated short trace waive a long-session stretch', () => {
  const { plan, t } = fixture(),
    long = { ...p, sessionMinutes: 90 };
  addCompleteStretches(plan);
  const before = structuredClone(plan);
  t.items = t.items.filter(i => i.prescription?.block !== 'cooldown');
  t.estimatedMinutes = 999;
  t.estimatedSeconds = 99999;
  plan.trace.push({
    ruleId: 'session.cooldown.stretch',
    reason: 'short_session_main_priority_requires_recomputed_default_overrun',
  });
  expect(independentlyProvedShortCooldown(t, long)).toBe(false);
  expect(scored(plan, long, 'session.cooldown.stretch')).toBeLessThan(scored(before, long, 'session.cooldown.stretch'));
  expect(validatePlan(plan, long).some(i => i.code === 'cooldown_stretch_missing')).toBe(false);
});
it('keeps two real source-prefix main lifts cold priorities after real main re-prescription without changing either original slot identity', () => {
  const { plan, t, work } = fixture(),
    old = work[1],
    replacement = prescribe(
      r.byExercise.get(old.exerciseId)!,
      p,
      r,
      safety(p, r),
      'main',
      goal.main_lift.sets_per_session[0],
    );
  replacement.prescription!.block = old.prescription!.block;
  replacement.prescription!.sourcePosition = old.prescription!.sourcePosition;
  replacement.prescription!.goalRole = 'main';
  t.items[t.items.indexOf(old)] = replacement;
  const cardio = prescribe(
    r.data.exercises.find(e => e.slug === 'custom-quiet-shadow-boxing')!,
    p,
    r,
    safety(p, r),
    'conditioning',
    1,
  );
  cardio.target = { metricType: 'duration', durationSeconds: r.get('aerobic.bout.any_length').min_bout_minutes * 60 };
  t.items.push(cardio);
  const identities = [work[0], replacement].map(i => [
    i.prescription?.block,
    i.prescription?.sourcePosition,
    i.prescription?.goalRole,
  ]);
  ensureCooldown(t, p, r, safety(p, r), true);
  expect(independentStrengthRoles(t.items).get(work[0])).toBe('main');
  expect(independentStrengthRoles(t.items).get(replacement)).toBe('main');
  expect(
    [work[0], replacement].map(i => [i.prescription?.block, i.prescription?.sourcePosition, i.prescription?.goalRole]),
  ).toEqual(identities);
  expect(independentCooldownIssues(plan, p).some(i => i.code === 'external_cooldown_priority')).toBe(false);
  addCompleteStretches(plan);
  const before = structuredClone(plan);
  const map = r.get('dose.muscle_groups').catalog_map,
    primary = new Set(r.byExercise.get(replacement.exerciseId)!.primaryMuscles!.map(m => map[m]));
  t.items = t.items.filter(
    i =>
      i.prescription?.block !== 'cooldown' ||
      !r.byExercise.get(i.exerciseId)?.stretch_targets?.some(g => primary.has(g)),
  );
  expect(independentCooldownIssues(plan, p).some(i => i.code === 'external_cooldown_priority')).toBe(true);
  expect(scored(plan, p, 'session.cooldown.stretch')).toBeLessThan(scored(before, p, 'session.cooldown.stretch'));
});
it('retains real main set caps and auxiliary rest/RIR limits without imposing a fatigue-incompatible upper RIR', () => {
  const { plan, work } = fixture(),
    before = structuredClone(plan);
  work[0].sets = goal.main_lift.sets_per_session[1] + 1;
  expect(independentStrengthIssues(plan, p).some(i => i.reason === 'actual_main_sets_above_source')).toBe(true);
  expect(validatePlan(plan, p).some(i => i.code === 'strength_main_sets')).toBe(true);
  const aux = work[1],
    e = r.byExercise.get(aux.exerciseId)!;
  aux.prescription!.structure = 'straight';
  aux.prescription!.restSeconds =
    r.get('dose.rest.table')[e.nsca_class === 'isolation' ? 'isolation' : 'other_compound'].bounds[0] - 1;
  aux.prescription!.rir = [0, 0];
  expect(independentStrengthIssues(plan, p).some(i => i.reason === 'actual_role_rest_outside_source')).toBe(true);
  expect(independentStrengthIssues(plan, p).some(i => i.reason === 'actual_role_rir_below_source_or_inverted')).toBe(
    true,
  );
  expect(scored(plan)).toBeLessThan(scored(before));
  aux.prescription!.rir = [goal.accessory.rir[1] + 1, goal.accessory.rir[1] + 2];
  expect(independentStrengthIssues(plan, p).some(i => i.reason === 'actual_role_rir_below_source_or_inverted')).toBe(
    false,
  );
});
it('rejects ten ordinary strength main reps while retaining the source upper bound of six', () => {
  const { plan, work } = fixture(),
    before = structuredClone(plan),
    main = work[0];
  main.target = { metricType: 'reps', reps: r.get('duration.capacity.table').model_params.compound_reps };
  expect(main.target.reps).toBe(10);
  expect(
    independentStrengthIssues(plan, p).some(
      i => i.reason === 'actual_reps_outside_source_role' && i.itemIndex === plan.templates[0].items.indexOf(main),
    ),
  ).toBe(true);
  expect(scored(plan)).toBeLessThan(scored(before));
  main.target.reps = goal.main_lift.reps[1];
  expect(main.target.reps).toBe(6);
  expect(validatePlan(plan, p).some(i => i.code === 'strength_main_reps')).toBe(false);
});
it.each(['intro', 'older_intro', 'older_trained', 'unknown_bp'] as const)(
  'keeps the more specific source main repetition range for %s',
  kind => {
    const plan = fixture().plan,
      main = plan.templates[0].items.find(i => i.prescription?.goalRole === 'main' && 'reps' in i.target)!;
    plan.templates = [{ ...plan.templates[0], items: [main] }];
    const profile = { ...p };
    let low: number, high: number;
    if (kind === 'intro') {
      profile.trainingAgeWeeks = r.get('goal.strength.beginner_rep_gate').weeks_trained_before_low_reps - 1;
      const gate = r.get('goal.strength.beginner_rep_gate').main_lift_reps_before_gate;
      low = gate.min;
      high = gate.max;
    } else if (kind.startsWith('older')) {
      profile.birthYearMonth = '1956-06';
      profile.population = { kind: 'older_adult', fallsAnswers: [false, false, false, false] };
      profile.trainingAgeWeeks =
        kind === 'older_intro' ? 0 : r.get('older.strength.progression').intro_phase_weeks.default;
      const range = r.get('older.strength.dose')[kind === 'older_intro' ? 'reps_phase_intro' : 'reps_phase_strength'];
      low = range.min;
      high = range.max;
    } else {
      profile.screening = { ...profile.screening, restingBp: 'unknown' };
      low = high = Math.max(goal.main_lift.reps[1], r.get('safety.hypertension.limits').min_reps_per_set);
    }
    for (const reps of [low, high]) {
      main.target = { metricType: 'reps', reps };
      expect(
        validatePlan(plan, profile).some(
          i =>
            i.code ===
            (kind === 'intro' ? 'beginner_strength_reps' : kind === 'unknown_bp' ? 'hypertension_reps' : 'older_reps'),
        ),
      ).toBe(false);
      expect(independentStrengthIssues(plan, profile).some(i => i.reason === 'actual_reps_outside_source_role')).toBe(
        false,
      );
    }
    main.target = { metricType: 'reps', reps: low - 1 };
    expect(
      validatePlan(plan, profile).some(
        i =>
          i.code ===
          (kind === 'intro' ? 'beginner_strength_reps' : kind === 'unknown_bp' ? 'hypertension_reps' : 'older_reps'),
      ),
    ).toBe(true);
    expect(independentStrengthIssues(plan, profile).some(i => i.reason === 'actual_reps_outside_source_role')).toBe(
      true,
    );
  },
);
it('does not apply the repetition main range to an actual isometric timed prescription', () => {
  const { plan } = fixture(),
    e = r.data.exercises.find(e => e.modality === 'isometric' && e.primary_pattern !== 'balance')!,
    i = prescribe(e, p, r, safety(p, r), 'main', goal.main_lift.sets_per_session[0]);
  i.prescription!.goalRole = 'main';
  i.prescription!.sourcePosition = 'main_1';
  i.target = { metricType: 'duration', durationSeconds: r.get('dose.isometric')[p.level].hold_s[0] };
  plan.templates = [{ ...plan.templates[0], items: [i] }];
  expect(validatePlan(plan, p).some(i => i.code === 'strength_main_reps')).toBe(false);
  expect(independentStrengthIssues(plan, p).some(i => i.reason === 'actual_reps_outside_source_role')).toBe(false);
});

it('rejects a single-set trained strength accessory instead of hiding an invalid cross-day split', () => {
  const { plan, work } = fixture(),
    item = work.find(i => i.prescription?.goalRole === 'accessory')!;
  expect(item).toBeDefined();
  const index = plan.templates[0].items.indexOf(item),
    minimum = r.get('goal.floor.all').sets_per_exercise_min;
  expect(minimum).toBe(2);
  const before = structuredClone(plan);
  item.sets = minimum - 1;
  expect(scored(plan, p, 'dose.sets_exercise')).toBeLessThan(scored(before, p, 'dose.sets_exercise'));
  expect(
    independentStrengthIssues(plan, p).some(
      i => i.reason === 'actual_work_sets_below_source_minimum' && i.itemIndex === index,
    ),
  ).toBe(true);
  item.sets = minimum;
  expect(scored(plan, p, 'dose.sets_exercise')).toBe(scored(before, p, 'dose.sets_exercise'));
  expect(
    independentStrengthIssues(plan, p).some(
      i => i.reason === 'actual_work_sets_below_source_minimum' && i.itemIndex === index,
    ),
  ).toBe(false);
});
