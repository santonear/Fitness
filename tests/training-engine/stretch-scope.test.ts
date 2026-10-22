import { it, expect } from 'vitest';
import { DATA, Rules } from '../../src/engine/data';
import { prescribe, type Template } from '../../src/engine/dose';
import { safety } from '../../src/engine/gates/strength-scoring';
import { ensureCooldown } from '../../src/engine/progression/legacy-cooldown';
import { validate } from './reference/legacy-validation';
import type { EnginePlan } from '../../src/engine/contracts';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import { independentElapsedAllocation } from '../unit/engine/reference/training-engine-goal-share';
import { actualBlockSeconds } from '../unit/engine/reference/training-engine-session-time';
import {
  independentCooldownCap,
  independentStretchPrimaryWarnings,
} from '../unit/engine/reference/training-engine-cooldown';
const p = baseProfile({ equipment: ['none', 'dumbbell', 'resistance-band'] }),
  r = new Rules();
function fixture(rules = r) {
  const s = safety(p, rules),
    t: Template = {
      id: 'scope',
      name: 'scope',
      estimatedMinutes: 30,
      items: ['bodyweight-squat', 'dumbbell-floor-press', 'bent-over-db-row'].map(slug => {
        const e = rules.data.exercises.find(e => e.slug === slug)!,
          i = prescribe(e, p, rules, s, 'main', 4);
        i.target = { metricType: 'reps', reps: 15 };
        i.prescription!.restSeconds = 180;
        return i;
      }),
    },
    plan: EnginePlan = {
      weeklyTarget: 3,
      sessionMinutes: 30,
      templates: [t],
      meta: { engineVersion: 'fixture', rulesVersion: rules.data.rulesVersion, seed: 'scope' },
      trace: [],
      notices: [],
      gates: [],
    };
  return { s, t, plan };
}
function short(chestFirst = false) {
  const f = fixture();
  if (chestFirst)
    for (const [index, item] of f.t.items.entries())
      item.prescription!.sourcePosition = ['main_2', 'main_1', 'main_3'][index];
  const map = r.get('dose.muscle_groups').catalog_map,
    major = r.get('dose.muscle_groups').target_groups;
  const groups = new Set(
    f.t.items.flatMap(i => {
      const e = r.byExercise.get(i.exerciseId)!;
      return [...(e.primaryMuscles ?? []), ...(e.secondaryMuscles ?? [])]
        .map(m => map[m])
        .filter(g => major.includes(g));
    }),
  );
  expect(groups.size).toBe(6);
  expect(r.data.exercises.filter(e => e.stretch_targets?.length).every(e => e.stretch_targets!.length === 1)).toBe(
    true,
  );
  const defaultLowerBound =
    independentElapsedAllocation(f.plan).total +
    groups.size * r.get('session.cooldown.stretch').total_s_per_muscle_target;
  expect(defaultLowerBound).toBeGreaterThan(p.sessionMinutes * 60 * r.get('duration.fit.tolerance').band[1]);
  ensureCooldown(
    f.t,
    p,
    r,
    { ...f.s, cooldownHoldSeconds: r.get('dose.stretch').hold_s.range[0], cooldownPrimaryOnly: true },
    true,
  );
  return f;
}
it('keeps unserved secondary groups as explicit warnings only after actual work already proves a short budget', () => {
  const { plan } = short(),
    issues = validate(plan, p, r);
  for (const group of ['shoulders', 'hamstrings'])
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'cooldown_stretch_target',
          severity: 'warning',
          reason: expect.stringContaining(`${group}:0`),
        }),
      ]),
    );
  expect(issues.some(i => i.code === 'cooldown_stretch_missing')).toBe(false);
});
it('still rejects a missing verified direct main stretch', () => {
  const { t, plan } = short(true);
  expect(
    t.items.some(
      i => i.prescription?.block === 'cooldown' && r.byExercise.get(i.exerciseId)?.stretch_targets?.includes('chest'),
    ),
  ).toBe(true);
  expect(validate(plan, p, r).some(i => i.code === 'cooldown_stretch_missing' && i.reason.endsWith('chest'))).toBe(
    false,
  );
  t.items = t.items.filter(i => !r.byExercise.get(i.exerciseId)?.stretch_targets?.includes('chest'));
  expect(validate(plan, p, r)).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        code: 'cooldown_stretch_missing',
        severity: 'error',
        reason: 'no_verified_static_stretch:chest',
      }),
    ]),
  );
});
it('never turns an unknown cooldown pose into verified main coverage', () => {
  const { t, plan } = short(true),
    unknown = r.data.exercises.find(e => e.modality === 'mobility' && !e.stretch_targets?.length)!;
  expect(
    t.items.some(
      i => i.prescription?.block === 'cooldown' && r.byExercise.get(i.exerciseId)?.stretch_targets?.includes('chest'),
    ),
  ).toBe(true);
  expect(validate(plan, p, r).some(i => i.code === 'cooldown_stretch_missing' && i.reason.endsWith('chest'))).toBe(
    false,
  );
  t.items = t.items.filter(i => !r.byExercise.get(i.exerciseId)?.stretch_targets?.includes('chest'));
  const i = prescribe(unknown, p, r, safety(p, r), 'cooldown', 2);
  i.sets = 2;
  i.target = { metricType: 'duration', durationSeconds: 30 };
  t.items.push(i);
  expect(validate(plan, p, r).some(i => i.code === 'cooldown_stretch_missing' && i.reason.endsWith('chest'))).toBe(
    true,
  );
});
it('cannot manufacture short scope from display metadata or a source-looking trace in a long actual budget', () => {
  const { t, plan } = short();
  t.estimatedMinutes = 999;
  t.estimatedSeconds = 99999;
  plan.trace = [
    { ruleId: 'session.cooldown.stretch', reason: 'short_session_main_priority_requires_recomputed_default_overrun' },
  ];
  const long = { ...p, sessionMinutes: 90 };
  expect(
    validate(plan, long, r).some(i => i.code === 'cooldown_stretch_missing' && i.reason.endsWith('shoulders')),
  ).toBe(true);
});
it.each(['empty', 'unmapped'] as const)(
  'reports unknown primary metadata without inventing primary stretch obligations from volume credit: %s',
  mode => {
    const data = structuredClone(DATA),
      e = data.exercises.find(e => e.slug === 'native-bodyweight-squat')!;
    e.primaryMuscles = mode === 'empty' ? [] : ['__unmapped__'];
    const rules = new Rules(data),
      { t, plan, s } = fixture(rules);
    t.items[0] = prescribe(e, p, rules, s, 'main', 4);
    t.items[0].target = { metricType: 'reps', reps: 15 };
    t.items[0].prescription!.restSeconds = 180;
    ensureCooldown(t, p, rules, { ...s, cooldownHoldSeconds: 10, cooldownPrimaryOnly: true }, true);
    t.items = t.items.filter(i => !rules.byExercise.get(i.exerciseId)?.stretch_targets?.includes('quads'));
    const issues = validate(plan, p, rules);
    expect(
      issues.some(i => i.code === 'stretch_primary_unknown' && i.itemIndex === 0 && i.severity === 'warning'),
    ).toBe(true);
    expect(issues.some(i => i.code === 'cooldown_stretch_missing' && i.reason.endsWith('quads'))).toBe(false);
    expect(independentStretchPrimaryWarnings(plan).some(i => i.itemIndex === 0 && i.severity === 'warning')).toBe(true);
  },
);
it('tries default full coverage for estimation while enforcing the actual cooldown cap and reporting budget omissions', () => {
  const { t, s, plan } = fixture();
  ensureCooldown(t, p, r, s, true, true);
  expect(
    t.items
      .filter(i => i.prescription?.block === 'cooldown')
      .flatMap(i => r.byExercise.get(i.exerciseId)?.stretch_targets ?? []),
  ).toEqual(expect.arrayContaining(['glutes', 'quads', 'chest', 'back', 'shoulders', 'hamstrings']));
  expect(actualBlockSeconds(t, 'cooldown')).toBeGreaterThan(independentCooldownCap(t, p));
  expect(validate(plan, p, r).some(i => i.code === 'cooldown_block_cap' && i.severity === 'error')).toBe(true);
  const actual = structuredClone(t);
  ensureCooldown(actual, p, r, s, true);
  expect(actualBlockSeconds(actual, 'cooldown')).toBeLessThanOrEqual(independentCooldownCap(actual, p));
  const issues = validate({ ...plan, templates: [actual] }, p, r);
  expect(issues.some(i => i.code === 'cooldown_block_cap' || i.code === 'cooldown_stretch_missing')).toBe(false);
  expect(issues.some(i => i.code === 'cooldown_stretch_target' && i.severity === 'warning')).toBe(true);
});
it('keeps an accessory direct muscle optional regardless of accessory array position', () => {
  for (const position of ['before', 'after']) {
    const { t, plan, s } = fixture(),
      e = r.data.exercises.find(e => e.slug === 'custom-seated-self-resisted-leg-curl')!,
      accessory = prescribe(e, p, r, s, 'accessory', 2);
    if (position === 'before') t.items.unshift(accessory);
    else t.items.push(accessory);
    ensureCooldown(t, p, r, { ...s, cooldownHoldSeconds: 10, cooldownPrimaryOnly: true }, true);
    const issues = validate(plan, p, r);
    expect(
      issues.some(
        i => i.code === 'cooldown_stretch_target' && i.reason.endsWith('hamstrings:0') && i.severity === 'warning',
      ),
    ).toBe(true);
    expect(issues.some(i => i.code === 'cooldown_stretch_missing' && i.reason.endsWith('hamstrings'))).toBe(false);
  }
});
