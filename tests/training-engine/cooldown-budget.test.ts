import { scorePlan } from '../../src/engine/score';
import { expect, it } from 'vitest';
import { Rules } from '../../src/engine/data';
import { prescribe } from '../../src/engine/dose';
import { safety } from '../../src/engine/gates/strength-scoring';
import type { EnginePlan } from '../../src/engine/contracts';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import { independentCooldownCap, independentCooldownIssues } from '../unit/engine/reference/training-engine-cooldown';
import { ensureCooldown } from '../../src/engine/progression/legacy-cooldown';
import { validatePlan } from '../../src/engine';
import { actualBlockSeconds } from '../unit/engine/reference/training-engine-session-time';
const r = new Rules();
function fixture() {
  const p = baseProfile({ sessionMinutes: 10 }),
    s = safety(p, r),
    make = (slug: string, block: 'main' | 'cooldown', seconds?: number) => {
      const e = r.data.exercises.find(e => e.slug === slug)!;
      expect(e).toBeDefined();
      const i = prescribe(e, p, r, s, block, 2);
      i.sets = 2;
      if (seconds !== undefined) i.target = { metricType: 'duration', durationSeconds: seconds };
      return i;
    },
    first = make('leg-extension', 'main'),
    second = make('bent-over-db-row', 'main');
  first.prescription!.sourcePosition = 'main_1';
  second.prescription!.sourcePosition = 'main_2';
  const plan: EnginePlan = {
    weeklyTarget: p.daysPerWeek,
    sessionMinutes: p.sessionMinutes,
    meta: { engineVersion: 'fixture', rulesVersion: r.data.rulesVersion, seed: 'cold-cap' },
    gates: [],
    trace: [],
    notices: [],
    templates: [
      {
        id: 'cold-cap',
        name: 'cold-cap',
        estimatedMinutes: 10,
        items: [first, second, make('standing-quad-stretch', 'cooldown', 10)],
      },
    ],
  };
  return { p, plan, make };
}
it('reads the actual source variant cap without adding the superseded base cooldown', () => {
  const { plan, p } = fixture(),
    t = plan.templates[0];
  for (const [minutes, expected] of [
    [30, 120],
    [45, 480],
    [60, 600],
  ] as const)
    expect(independentCooldownCap(t, { ...p, goal: 'mobility', sessionMinutes: minutes })).toBe(expected);
  t.items[0].prescription!.structure = 'circuit';
  expect(independentCooldownCap(t, p)).toBe(300);
});
it('counts every real cooldown second including light cardio and does not let display estimates exempt overflow', () => {
  const { p, plan, make } = fixture(),
    t = plan.templates[0],
    cardio = make('custom-quiet-march', 'cooldown', 60);
  cardio.sets = 1;
  cardio.prescription!.targetRpe = [1, 4];
  t.items.push(cardio);
  t.estimatedSeconds = 1;
  t.estimatedMinutes = 1;
  expect(independentCooldownIssues(plan, p).some(i => i.code === 'external_cooldown_cap')).toBe(true);
});
it('requires an explicit warning for a real priority-prefix budget omission, without dropping the unavailable-candidate hard guard', () => {
  const { p, plan } = fixture();
  plan.quality = {
    status: 'limited',
    basis: 'source_constraint',
    issues: [
      {
        code: 'cooldown_stretch_target',
        ruleId: 'session.cooldown.stretch',
        severity: 'warning',
        templateId: 'cold-cap',
        reason: 'back:0',
      },
    ],
  };
  expect(independentCooldownIssues(plan, p)).toEqual([]);
  plan.quality.issues = [];
  expect(independentCooldownIssues(plan, p).some(i => i.code === 'external_cooldown_warning')).toBe(true);
  const excluded = {
    ...p,
    preferences: {
      ...p.preferences,
      excludedExerciseIds: r.data.exercises.filter(e => e.stretch_targets?.includes('back')).map(e => e.id),
    },
  };
  expect(
    independentCooldownIssues(plan, excluded).some(
      i => i.code === 'external_cooldown_priority' && i.reason === 'no_verified_safe_priority_candidate:back',
    ),
  ).toBe(true);
});
it.each(['cardio', 'lower_priority'] as const)('cannot use %s to remove a feasible highest-priority stretch', mode => {
  const { p, plan, make } = fixture(),
    t = plan.templates[0];
  t.items = t.items.filter(i => i.prescription?.block !== 'cooldown');
  const other = make(
    mode === 'cardio' ? 'custom-quiet-march' : 'custom-standing-upper-back-stretch',
    'cooldown',
    mode === 'cardio' ? 50 : 15,
  );
  if (mode === 'cardio') other.sets = 1;
  t.items.push(other);
  plan.quality = {
    status: 'limited',
    basis: 'source_constraint',
    issues: [
      {
        code: 'cooldown_stretch_target',
        ruleId: 'session.cooldown.stretch',
        severity: 'warning',
        templateId: t.id,
        reason: 'quads:0',
      },
    ],
  };
  expect(
    independentCooldownIssues(plan, p).some(
      i =>
        i.code === 'external_cooldown_priority' && i.reason === 'priority_fits_before_cardio_or_lower_priority:quads',
    ),
  ).toBe(true);
});
it('keeps the real short-session stretch omission and overflow observable without a removed warning proof or admission exemption', () => {
  const { p, plan, make } = fixture(),
    t = plan.templates[0];
  ensureCooldown(t, p, r, safety(p, r), true);
  const groups = () =>
    new Set(
      t.items
        .filter(i => i.prescription?.block === 'cooldown')
        .flatMap(i => r.byExercise.get(i.exerciseId)?.stretch_targets ?? []),
    );
  expect(groups().has('quads')).toBe(true);
  expect(groups().has('back')).toBe(false);
  expect(p.sessionMinutes).toBeLessThanOrEqual(r.get('session.cooldown.stretch').exempt_when_session_minutes_max);
  expect(scorePlan(plan, p, r).perRule.some(row => row.id === 'session.cooldown.stretch')).toBe(false);
  // The original equipment-incompatible work remains rejected independently of the soft stretch target.
  expect(validatePlan(plan, p).filter(i => i.code === 'excluded_exercise' && i.severity === 'error')).toHaveLength(2);
  const missing = structuredClone(plan);
  missing.templates[0].items = missing.templates[0].items.filter(
    i => !r.byExercise.get(i.exerciseId)?.stretch_targets?.includes('quads'),
  );
  expect(
    independentCooldownIssues(missing, p).some(
      i => i.code === 'external_cooldown_priority' && i.reason.endsWith('quads'),
    ),
  ).toBe(true);
  const cardio = make('custom-quiet-march', 'cooldown', 60);
  cardio.sets = 1;
  t.items.push(cardio);
  expect(actualBlockSeconds(t, 'cooldown')).toBeGreaterThan(independentCooldownCap(t, p));
  expect(independentCooldownIssues(plan, p).some(i => i.code === 'external_cooldown_cap')).toBe(true);
  expect(validatePlan(plan, p).filter(i => i.code === 'excluded_exercise' && i.severity === 'error')).toHaveLength(2);
});
it('reduces an earlier preferred hold to its legal source minimum before omitting a later priority that can fit the total cap', () => {
  const { p: base, plan, make } = fixture(),
    p = { ...base, sessionMinutes: 30 },
    t = plan.templates[0];
  plan.sessionMinutes = 30;
  t.items = [make('dumbbell-floor-press', 'main'), make('leg-extension', 'main'), make('bent-over-db-row', 'main')];
  for (const [index, item] of t.items.entries()) item.prescription!.sourcePosition = `main_${index + 1}`;
  ensureCooldown(t, p, r, safety(p, r), true);
  plan.quality = { status: 'limited', basis: 'source_constraint', issues: validatePlan(plan, p) };
  expect(independentCooldownCap(t, p)).toBe(120);
  expect(independentCooldownIssues(plan, p)).toEqual([]);
  expect(
    t.items
      .filter(i => i.prescription?.block === 'cooldown')
      .flatMap(i => r.byExercise.get(i.exerciseId)?.stretch_targets ?? []),
  ).toEqual(expect.arrayContaining(['chest', 'quads', 'back']));
});
function retainedFixture() {
  const { plan, p: base, make } = fixture(),
    p = { ...base, sessionMinutes: 30 },
    t = plan.templates[0];
  plan.sessionMinutes = 30;
  t.estimatedMinutes = 30;
  const work = make('custom-standing-self-row', 'main');
  work.sets = 1;
  work.prescription!.sourcePosition = 'main_1';
  const cardio = make('custom-quiet-march', 'cooldown', 1);
  cardio.sets = 1;
  t.items = [
    work,
    cardio,
    make('custom-standing-upper-back-stretch', 'cooldown', 15),
    make('cross-body-shoulder-stretch', 'cooldown', 10),
  ];
  return { plan, p, t, make };
}
it('retains legal static doses and their exact original slots while extending only the existing light-cardio dose', () => {
  const { plan, p, t } = retainedFixture(),
    before = structuredClone(t),
    ids = t.items.map(i => i.exerciseId),
    statics = structuredClone(t.items.slice(2));
  ensureCooldown(t, p, r, safety(p, r));
  expect(t.items.map(i => i.exerciseId)).toEqual(ids);
  expect(t.items.slice(2)).toEqual(statics);
  expect(t.items[0]).toEqual(before.items[0]);
  expect(t.items[1].exerciseId).toBe(before.items[1].exerciseId);
  expect(
    'durationSeconds' in t.items[1].target &&
      'durationSeconds' in before.items[1].target &&
      t.items[1].target.durationSeconds > before.items[1].target.durationSeconds,
  ).toBe(true);
  expect(actualBlockSeconds(t, 'cooldown')).toBe(independentCooldownCap(t, p));
  expect(independentCooldownIssues(plan, p)).toEqual([]);
  expect(new Set(t.items.map(i => i.exerciseId)).size).toBe(t.items.length);
});
it('rebuilds an existing identity with a bogus static hold instead of treating matching IDs as proof of safe dose', () => {
  const { plan, p, t } = retainedFixture();
  t.items[2].target = { metricType: 'duration', durationSeconds: 999 };
  expect(validatePlan(plan, p).some(i => i.code === 'stretch_source_hold_bounds' && i.severity === 'error')).toBe(true);
  expect(independentCooldownIssues(plan, p).some(i => i.code === 'external_cooldown_cap')).toBe(true);
  ensureCooldown(t, p, r, safety(p, r));
  for (const i of t.items)
    if (r.byExercise.get(i.exerciseId)?.mobility_type === 'static') {
      const e = r.byExercise.get(i.exerciseId)!,
        range = e.stretch_hold_s ?? r.get('dose.stretch').hold_s.range;
      expect('durationSeconds' in i.target).toBe(true);
      if ('durationSeconds' in i.target) {
        expect(i.target.durationSeconds).toBeGreaterThanOrEqual(range[0]);
        expect(i.target.durationSeconds).toBeLessThanOrEqual(range[1]);
      }
    }
  expect(independentCooldownIssues(plan, p)).toEqual([]);
  expect(
    validatePlan(plan, p).some(
      i =>
        ['stretch_source_hold_bounds', 'stretch_hold_cap', 'cooldown_block_cap'].includes(i.code) &&
        i.severity === 'error',
    ),
  ).toBe(false);
});
it('does not reuse an old legal cooldown to waive a newly added highest-priority main muscle', () => {
  const { plan, p, t, make } = retainedFixture();
  ensureCooldown(t, p, r, safety(p, r));
  const press = make('dumbbell-floor-press', 'main');
  press.prescription!.sourcePosition = 'main_1';
  t.items[0].prescription!.sourcePosition = 'main_2';
  t.items.unshift(press);
  expect(
    independentCooldownIssues(plan, p).some(i => i.code === 'external_cooldown_priority' && i.reason.endsWith('chest')),
  ).toBe(true);
  expect(scorePlan(plan, p, r).perRule.find(row => row.id === 'session.cooldown.stretch')!.satisfaction).toBeLessThan(
    1,
  );
  const work = structuredClone(t.items.filter(i => i.prescription?.block === 'main'));
  ensureCooldown(t, p, r, safety(p, r));
  expect(t.items.filter(i => i.prescription?.block === 'main')).toEqual(work);
  expect(
    t.items.some(
      i => i.prescription?.block === 'cooldown' && r.byExercise.get(i.exerciseId)?.stretch_targets?.includes('chest'),
    ),
  ).toBe(true);
  expect(independentCooldownIssues(plan, p)).toEqual([]);
});
it('retains a default legal hold but honors an explicit legal short-hold request within each action source intersection', () => {
  const { plan, p: base, t } = retainedFixture(),
    p = { ...base, sessionMinutes: 45 };
  plan.sessionMinutes = 45;
  t.estimatedMinutes = 45;
  const back = t.items.find(i => r.byExercise.get(i.exerciseId)?.stretch_targets?.includes('back'))!,
    e = r.byExercise.get(back.exerciseId)!;
  back.target = { metricType: 'duration', durationSeconds: e.stretch_hold_s![1] };
  ensureCooldown(t, p, r, safety(p, r));
  const retained = t.items.find(i => i.exerciseId === e.id)!;
  expect(retained.target).toEqual({ metricType: 'duration', durationSeconds: e.stretch_hold_s![1] });
  const short = r.get('dose.stretch').hold_s.range[0];
  ensureCooldown(t, p, r, { ...safety(p, r), cooldownHoldSeconds: short });
  const changed = t.items.find(i => r.byExercise.get(i.exerciseId)?.stretch_targets?.includes('back'))!;
  expect(changed).toBeDefined();
  const selected = r.byExercise.get(changed.exerciseId)!;
  expect(changed.target).toEqual({
    metricType: 'duration',
    durationSeconds: Math.max(short, selected.stretch_hold_s?.[0] ?? short),
  });
  expect('durationSeconds' in changed.target && changed.target.durationSeconds < e.stretch_hold_s![1]).toBe(true);
  expect(independentCooldownIssues(plan, p)).toEqual([]);
  expect(actualBlockSeconds(t, 'cooldown')).toBeLessThanOrEqual(independentCooldownCap(t, p));
});
