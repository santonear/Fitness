import { expect, it } from 'vitest';
import { DATA, Rules } from '../../src/engine/data';
import { prescribe } from '../../src/engine/dose';
import { safety } from '../../src/engine/gates/strength-scoring';
import { ensureCooldown, plannedCooldown, shortStretchSession } from '../../src/engine/progression/legacy-cooldown';
import { validate } from './reference/legacy-validation';
import type { EnginePlan } from '../../src/engine/contracts';
import type { SessionTemplate } from '../../src/domain/v8/contracts';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import { independentElapsedAllocation } from '../unit/engine/reference/training-engine-goal-share';
import { independentlyProvedShortCooldown } from '../unit/engine/reference/training-engine-cooldown';

function fixture() {
  const data = structuredClone(DATA);
  // Controlled evidence gap, never mutate production annotations or infer a safe pose.
  for (const exercise of data.exercises)
    if (exercise.stretch_targets?.includes('shoulders')) delete exercise.stretch_targets;
  const rules = new Rules(data),
    profile = baseProfile({ equipment: ['none', 'dumbbell', 'resistance-band'] }),
    state = safety(profile, rules);
  const template: SessionTemplate = {
    id: 'scope',
    name: 'scope',
    estimatedMinutes: 30,
    items: ['bodyweight-squat', 'dumbbell-floor-press', 'bent-over-db-row'].map((slug, index) => {
      const exercise = rules.data.exercises.find(exercise => exercise.slug === slug)!;
      const item = prescribe(exercise, profile, rules, state, 'main', 4);
      item.target = { metricType: 'reps', reps: 15 };
      item.prescription!.restSeconds = 180;
      item.prescription!.sourcePosition = `main_${index + 1}`;
      return item;
    }),
  };
  const plan: EnginePlan = {
    templates: [template],
    weeklyTarget: 3,
    sessionMinutes: 30,
    meta: { engineVersion: 'fixture', rulesVersion: rules.data.rulesVersion, seed: 'scope' },
    trace: [],
    notices: [],
    gates: [],
  };
  return { data, rules, profile, state, template, plan };
}

it('reports an optional secondary pool gap as a warning only after a real short-session proof', () => {
  const { rules, profile, state, template, plan } = fixture(),
    map = rules.get('dose.muscle_groups').catalog_map;
  const primary = template.items.flatMap(item =>
    rules.byExercise.get(item.exerciseId)!.primaryMuscles?.map(muscle => map[muscle]),
  );
  expect(primary).not.toContain('shoulders');
  expect(
    template.items.some(item =>
      rules.byExercise.get(item.exerciseId)!.secondaryMuscles?.some(muscle => map[muscle] === 'shoulders'),
    ),
  ).toBe(true);
  // Independently reconstruct full-default verified cold work, rather than trust estimated metadata.
  expect(independentElapsedAllocation({ templates: [template] }).total).toBe(1790);
  expect(independentlyProvedShortCooldown(template, profile)).toBe(true);
  expect(shortStretchSession(template, profile, rules, state)).toBe(true);
  ensureCooldown(template, profile, rules, { ...state, cooldownHoldSeconds: 10, cooldownPrimaryOnly: true }, true);
  const canonical = plannedCooldown(template, profile, rules, { ...state, cooldownPrimaryOnly: true });
  expect(canonical.optionalUncovered).toContain('shoulders');
  expect(canonical.omitted).not.toContain('shoulders');
  expect(canonical.missing).not.toContain('shoulders');
  const issues = validate(plan, profile, rules);
  expect(issues.some(issue => issue.code === 'cooldown_stretch_missing' && issue.reason.endsWith('shoulders'))).toBe(
    false,
  );
  expect(
    issues.some(
      issue =>
        issue.code === 'cooldown_stretch_target' &&
        issue.reason.endsWith('shoulders:0') &&
        issue.severity === 'warning',
    ),
  ).toBe(true);
  expect(
    validate(plan, { ...profile, sessionMinutes: 90 }, rules).some(
      issue => issue.code === 'cooldown_stretch_missing' && issue.reason.endsWith('shoulders'),
    ),
  ).toBe(true);
});

it('keeps a true priority primary pool gap hard even in the same genuinely short session', () => {
  const { data, profile, state, template, plan } = fixture();
  for (const exercise of data.exercises)
    if (exercise.stretch_targets?.includes('chest')) delete exercise.stretch_targets;
  const rules = new Rules(data);
  expect(
    template.items.some(item =>
      rules.byExercise
        .get(item.exerciseId)!
        .primaryMuscles?.some(muscle => rules.get('dose.muscle_groups').catalog_map[muscle] === 'chest'),
    ),
  ).toBe(true);
  ensureCooldown(template, profile, rules, { ...state, cooldownHoldSeconds: 10, cooldownPrimaryOnly: true }, true);
  expect(
    validate(plan, profile, rules).some(
      issue =>
        issue.code === 'cooldown_stretch_missing' && issue.reason.endsWith('chest') && issue.severity === 'error',
    ),
  ).toBe(true);
});

it('does not let an optional pool warning waive selected static dose or actual five-minute safety', () => {
  const { rules, profile, state, template, plan } = fixture();
  ensureCooldown(template, profile, rules, { ...state, cooldownHoldSeconds: 10, cooldownPrimaryOnly: true }, true);
  const selected = template.items.find(
    item =>
      item.prescription?.block === 'cooldown' && rules.byExercise.get(item.exerciseId)?.mobility_type === 'static',
  );
  expect(selected).toBeDefined();
  selected!.sets = 1;
  selected!.target = { metricType: 'duration', durationSeconds: 1 };
  const cardio = rules.data.exercises.find(
    exercise => exercise.modality === 'cardio' && exercise.use.includes('conditioning'),
  )!;
  const aerobic = prescribe(cardio, profile, rules, state, 'conditioning', 1);
  aerobic.target = { metricType: 'duration', durationSeconds: 60 };
  aerobic.prescription!.targetRpe = [5, 6];
  template.items.push(aerobic);
  const issues = validate(plan, profile, rules);
  expect(issues.some(issue => issue.code === 'stretch_dose_bounds' && issue.severity === 'error')).toBe(true);
  expect(issues.some(issue => issue.code === 'safety_cooldown_min' && issue.severity === 'error')).toBe(true);
});
