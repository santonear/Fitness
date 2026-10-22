import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { PrescriptionDetails } from '../../../src/ui/pages/training/PrescriptionDetails';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
import { expect, it } from 'vitest';
import { Rules, type Exercise } from '../../../src/engine/data';
import { substituteItem } from '../../../src/engine/operations';
import { prescribe } from '../../../src/engine/dose';
import { runGates } from '../../../src/engine/gates';
import { isHardEligible } from '../../../src/engine/candidates';
import { fixtureProfile } from './fixtures';
import type { Caution, Pattern } from '../../../src/engine/contracts';
const full = new Rules();
function fixture(joint: Caution, pattern: Pattern, slugs: string[]) {
  const base = full.data.exercises.find(e => e.slug === 'bodyweight-squat')!,
    ids = full.data.exercises.map(e => e.id).sort();
  const exercise = (slug: string, id: string): Exercise => ({
    ...structuredClone(base),
    id,
    slug,
    name: { zh: slug, en: slug },
    primary_pattern: pattern,
    secondary_patterns: [],
    modality: 'strength',
    difficulty: 2,
    joint_load: { knee: 0, back: 0, shoulder: 0, wrist: 0 },
    flags: [],
    equipment_required: [],
    equipment_alternatives: {},
    space: 'mat',
    noise: 0,
    position: ['standing'],
    use: ['main', 'accessory'],
    ladder: { id: null, step: 0 },
  });
  const original = { ...exercise('original', ids.at(-1)!), difficulty: 4 },
    candidates = slugs.map((slug, index) => exercise(slug, ids[slugs.length - index]));
  const r = new Rules({ ...full.data, exercises: [original, ...candidates] }),
    p = baseProfile({
      ...structuredClone(fixtureProfile),
      level: 'intermediate',
      trainingAgeWeeks: 30,
      cautions: [joint],
      equipment: ['none', 'dumbbell'],
    }),
    g = runGates(p, r),
    item = prescribe(original, p, r, g.restrictions, 'main', 2);
  return {
    r,
    p,
    g,
    item,
    original,
    candidates,
    run: () => substituteItem(item, p, 'pain', r),
  };
}
it.each([
  ['knee', 'squat', ['box-squat', 'bodyweight-squat']],
  ['back', 'hinge', ['kettlebell-deadlift', 'glute-bridge']],
  ['shoulder', 'push_horizontal', ['incline-db-press', 'db-bench-press']],
  ['wrist', 'isolation_upper', ['hammer-curl', 'ez-bar-curl']],
] as [Caution, Pattern, string[]][])(
  'uses authored first passing %s substitution, independent of UUID order',
  (joint, pattern, slugs) => {
    const f = fixture(joint, pattern, slugs);
    expect(f.candidates[0].id > f.candidates[1].id).toBe(true);
    for (const e of f.candidates) expect(isHardEligible(e, f.p, f.g, { rules: f.r })).toBe(true);
    const out = f.run();
    expect(out.noop).toBe(false);
    expect(out.value.exerciseId).toBe(f.candidates[0].id);
    expect(out.trace.some(row => row.ruleId === `caution.${joint}.substitute`)).toBe(true);
  },
);
it.each(['equipment', 'space', 'quiet', 'joint', 'difficulty', 'excluded', 'pain'] as const)(
  'skips the preferred source entry when %s makes it illegal',
  kind => {
    const f = fixture('knee', 'squat', ['box-squat', 'bodyweight-squat']);
    if (kind === 'equipment') f.candidates[0].equipment_required = ['leg-press'];
    if (kind === 'space') ((f.candidates[0].space = 'large'), (f.p.constraints.space = 'mat'));
    if (kind === 'quiet') ((f.candidates[0].noise = 1), (f.p.constraints.quiet = true));
    if (kind === 'joint') f.candidates[0].joint_load.knee = 3;
    if (kind === 'difficulty') f.candidates[0].difficulty = 5;
    if (kind === 'excluded') f.p.preferences.excludedExerciseIds = [f.candidates[0].id];
    if (kind === 'pain') f.p.painState = [{ pattern: 'squat', remainingSessions: 1 }];
    const out = f.run();
    if (kind === 'pain') expect(out.noop).toBe(true);
    else expect(out.value.exerciseId).toBe(f.candidates[1].id);
  },
);
it('does not promote a harder or different-pattern table entry over the source common candidate pool', () => {
  const f = fixture('shoulder', 'push_horizontal', ['landmine-press', 'incline-db-press', 'db-bench-press']);
  f.candidates[0].primary_pattern = 'push_vertical';
  f.original.difficulty = 2;
  f.candidates[1].difficulty = 3;
  expect(isHardEligible(f.candidates[1], f.p, f.g, { rules: f.r })).toBe(true);
  expect(f.run().value.exerciseId).toBe(f.candidates[2].id);
});
it('requires source wrist support equipment and retains approved cue text on the prescription', () => {
  const f = fixture('wrist', 'push_horizontal', ['push-up', 'incline-push-ups', 'chest-press-machine']);
  const out = f.run();
  expect(out.value.exerciseId).toBe(f.candidates[0].id);
  expect(out.value.prescription?.safetyCue).toEqual(f.r.text('caution.copy.labels.wrist_neutral'));
  expect(
    out.trace.some(row => row.ruleId === 'caution.wrist.substitute' && row.details?.cue === 'neutral_wrist_on_handles'),
  ).toBe(true);
});
it('does not apply a wrist-neutral source variant without handles or dumbbells', () => {
  const f = fixture('wrist', 'push_horizontal', ['push-up', 'incline-push-ups', 'chest-press-machine']);
  f.p.equipment = ['none'];
  expect(f.run().value.exerciseId).toBe(f.candidates[2].id);
});
it('retains source cue identity and displays its registered literal instruction', () => {
  const f = fixture('knee', 'squat', ['box-squat', 'bodyweight-squat']),
    out = f.run();
  expect(
    out.trace.some(row => row.ruleId === 'caution.knee.substitute' && row.details?.cue === 'comfortable_box_height'),
  ).toBe(true);
  expect(out.value.prescription?.safetyCue).toEqual(f.r.text('caution.copy.labels.comfortable_box_height'));
});

it('honors authored unless and does not fall back to the forbidden row without its annotation', () => {
  const f = fixture('back', 'anti_extension', ['bird-dog', 'side-plank', 'dead-bug', 'unlisted-safe']);
  f.p.population = {
    kind: 'pregnant',
    week: 8,
    providerCleared: true,
    prenatalCareConfirmed: true,
    contraindicationsConfirmedNone: true,
    lastScreenedWeek: 8,
  };
  f.p.preferences.excludedExerciseIds = f.candidates.slice(0, 2).map(e => e.id);
  expect(f.run().value.exerciseId).toBe(f.candidates[3].id);
});
it('keeps source fallback ladder, load, difficulty and preference priority when the joint table has no entry', () => {
  const f = fixture('knee', 'anti_rotation', ['safe-low-load', 'safe-lower-ladder']);
  f.original.ladder = { id: 'source-ladder', step: 3 };
  f.candidates[1].ladder = { id: 'source-ladder', step: 2 };
  f.candidates[0].joint_load.knee = 0;
  f.candidates[1].joint_load.knee = 1;
  expect(f.run().value.exerciseId).toBe(f.candidates[1].id);
});
it('never returns an excluded previously substituted identity even if it is the first source entry', () => {
  const f = fixture('knee', 'squat', ['box-squat', 'bodyweight-squat']);
  f.item.prescription!.excludedPreviousIds = [f.candidates[0].id];
  expect(f.run().value.exerciseId).toBe(f.candidates[1].id);
});
it('intersects a source table hold with the common hard hold bounds and skips an empty intersection', () => {
  const f = fixture('knee', 'squat', ['wall-sit', 'safe-unlisted']);
  f.candidates[0].modality = 'isometric';
  f.candidates[0].metricType = 'duration';
  const ordinary = f.run();
  expect(ordinary.value.exerciseId).toBe(f.candidates[0].id);
  expect(ordinary.value.target.metricType).toBe('duration');
  if (ordinary.value.target.metricType !== 'duration') throw Error('Expected authored hold');
  expect(ordinary.value.target.durationSeconds).toBeGreaterThanOrEqual(30);
  expect(ordinary.value.target.durationSeconds).toBeLessThanOrEqual(45);
  const rules = new Rules({
    ...f.r.data,
    rules: f.r.data.rules.map(rule =>
      rule.id === 'dose.isometric'
        ? {
            ...rule,
            value: {
              ...rule.value,
              intermediate: { ...rule.value!.intermediate, hold_s: [50, 60] },
            },
          }
        : rule,
    ),
  });
  expect(substituteItem(f.item, f.p, 'pain', rules).value.exerciseId).toBe(f.candidates[1].id);
});

it.each([
  ['knee', 'squat', 'box-squat', 'comfortable_box_height', '坐到舒适高度'],
  ['knee', 'squat', 'bodyweight-squat', 'partial_range_or_tempo', '部分幅度或慢节奏自重深蹲'],
  ['knee', 'squat', 'stability-ball-wall-squat', 'partial_range', '幅度小一点通常更舒服，按你觉得舒适的深度来做就好。'],
  ['knee', 'squat', 'leg-press', 'limited_range', '限幅腿举'],
  ['knee', 'lunge', 'step-ups', 'low_box', '低箱踏步'],
  ['back', 'hinge', 'kettlebell-deadlift', 'from_blocks_raised_start', '从垫高处起'],
  ['back', 'pull_horizontal', 'one-arm-kettlebell-row', 'bench_supported', '凳上支撑'],
  ['shoulder', 'push_horizontal', 'db-bench-press', 'neutral_grip', '对握哑铃卧推'],
  ['shoulder', 'push_horizontal', 'incline-push-ups', 'reduced_depth', '减小幅度的上斜俯卧撑'],
] as [Caution, Pattern, string, string, string][])(
  'displays the authored %s / %s / %s cue without changing dose',
  (joint, pattern, slug, cue, zh) => {
    const f = fixture(joint, pattern, [slug]),
      before = prescribe(f.candidates[0], f.p, f.r, f.g.restrictions, 'main', f.item.sets),
      out = f.run(),
      key = cue === 'partial_range' ? 'pain.copy.shorter_range' : `caution.copy.labels.${cue}`;
    expect(out.noop).toBe(false);
    expect(out.value.target).toEqual(before.target);
    expect(out.value.sets).toBe(before.sets);
    expect(out.value.prescription?.safetyCue).toEqual(f.r.text(key));
    expect(out.value.prescription!.safetyCue!.zh).toBe(zh);
    for (const locale of ['zh', 'en'] as const) {
      const html = renderToStaticMarkup(
        createElement(PrescriptionDetails, {
          prescription: out.value.prescription,
          locale,
        }),
      );
      expect(html).toContain(f.r.text(key)[locale]);
    }
    f.p.preferences.excludedExerciseIds = [f.candidates[0].id];
    const blocked = f.run();
    expect(blocked.noop).toBe(true);
    expect(blocked.value.prescription?.safetyCue).toEqual(f.item.prescription?.safetyCue);
  },
);
