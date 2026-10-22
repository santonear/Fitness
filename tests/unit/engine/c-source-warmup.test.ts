import { estimateSeconds } from '../../../src/engine/fit';
import { expect, it } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { prescribe, type Template } from '../../../src/engine/dose';
import { sourceWarmupRamps, refreshWarmupRamps } from '../../../src/engine/source-warmup';
import { runGates } from '../../../src/engine/gates';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
import { independentSourceRampSeconds } from './reference/training-engine-source-warmup';
const r = new Rules(),
  p = baseProfile({ goal: 'mobility', level: 'intermediate', daysPerWeek: 6, sessionMinutes: 63 }),
  s = runGates(p, r).restrictions;
function fixture() {
  const items = ['single-leg-rdl-hold', 'custom-self-resisted-overhead-press', 'custom-self-resisted-pulldown'].map(
    (slug, n) => {
      const e = r.data.exercises.find(e => e.slug === slug)!;
      expect(e).toBeDefined();
      const item = prescribe(e, p, r, s, 'main', 2);
      item.prescription!.sourcePosition = `main_${n + 1}`;
      return item;
    },
  );
  return { id: 'real-fb-b', name: '', estimatedMinutes: 63, items } as Template;
}
it('does not erase a real main warmup because an unrelated auxiliary retains its origin position', () => {
  const t = fixture(),
    target = t.items[1],
    before = sourceWarmupRamps(t, p, r).find(x => x.exerciseId === target.exerciseId);
  expect(before?.seconds).toBeGreaterThan(0);
  const auxiliary = prescribe(
    r.data.exercises.find(e => e.slug === 'warrior-three')!,
    p,
    r,
    s,
    'accessory',
    2,
  );
  auxiliary.prescription!.sourcePosition = 'core_1';
  t.items.push(auxiliary);
  const independent = independentSourceRampSeconds(t.items, p, 63);
  expect(independent[1]).toBe(before!.seconds);
  expect(sourceWarmupRamps(t, p, r).find(x => x.exerciseId === target.exerciseId)).toEqual(before);
  const refreshed = refreshWarmupRamps(t, p, r);
  expect(refreshed.items[1].prescription!.warmupSeconds).toBe(independent[1]);
  expect(target.prescription!.warmupSeconds).toBeUndefined();
});
it('refuses duplicated bodyweight main identities and a main pattern that does not belong to an allowed source day', () => {
  const duplicate = fixture();
  duplicate.items.push(structuredClone(duplicate.items[1]));
  expect(sourceWarmupRamps(duplicate, p, r)).toEqual([]);
  const wrong = fixture(),
    replacement = prescribe(
      r.data.exercises.find(e => e.slug === 'bodyweight-squat')!,
      p,
      r,
      s,
      'main',
      2,
    );
  replacement.prescription!.sourcePosition = 'main_2';
  wrong.items[1] = replacement;
  expect(sourceWarmupRamps(wrong, p, r)).toEqual([]);
});

it('recognizes V2 positions scoped to their template while retaining independent source seconds', () => {
  const t = fixture(),
    expected = independentSourceRampSeconds(t.items, p, 63);
  for (const item of t.items) item.prescription!.sourcePosition = t.id + '-M1-' + item.prescription!.sourcePosition;
  const rows = sourceWarmupRamps(t, p, r);
  expect(rows.map(row => [row.itemIndex, row.seconds])).toEqual(
    expected.flatMap((seconds, n) => (seconds ? [[n, seconds]] : [])),
  );
  const forged = structuredClone(t);
  for (const item of forged.items)
    item.prescription!.sourcePosition = 'different-template-M1-' + item.prescription!.sourcePosition!.split('-').at(-1);
  expect(sourceWarmupRamps(forged, p, r)).toEqual([]);
});
it('refreshes changed prescriptions and removes stale source ramps without mutating the baseline', () => {
  const t = fixture(),
    before = structuredClone(t);
  t.items[1].prescription!.warmupSeconds = 999;
  const refreshed = refreshWarmupRamps(t, p, r);
  expect(refreshed.items[1].prescription!.warmupSeconds).toBe(independentSourceRampSeconds(t.items, p, 63)[1]);
  expect(t.items[1].prescription!.warmupSeconds).toBe(999);
  const wrong = structuredClone(before);
  wrong.items[1].prescription!.sourcePosition = 'not-a-main';
  wrong.items[1].prescription!.warmupSeconds = 999;
  expect(refreshWarmupRamps(wrong, p, r).items[1].prescription!.warmupSeconds).toBeUndefined();
});
it('preserves loaded ramp schemes and counts both grouped members exactly once', () => {
  const profile = baseProfile({
      goal: 'muscle',
      level: 'intermediate',
      trainingAgeWeeks: 52,
      sessionMinutes: 45,
      equipment: ['none', 'dumbbell', 'barbell'],
      daysPerWeek: 3,
    }),
    state = runGates(profile, r).restrictions,
    setup = r.get('duration.transition.setup').setup_s_defaults,
    first = r.data.exercises.find(
      e =>
        e.modality === 'strength' &&
        e.nsca_class === 'compound' &&
        e.metricType === 'reps_load' &&
        e.time.setup_s === setup.dumbbell_kettlebell_band,
    )!,
    later = r.data.exercises.find(
      e =>
        e.modality === 'strength' &&
        e.nsca_class === 'compound' &&
        e.metricType === 'reps_load' &&
        e.time.setup_s === setup.barbell,
    )!;
  const items = [first, later].map((e, n) => {
      const item = prescribe(e, profile, r, state, 'main', n + 1);
      item.target = { metricType: 'reps_load', reps: 10, loadGrams: 10000 };
      Object.assign(item.prescription!, { structure: 'superset', groupId: 'loaded-pair' });
      return item;
    }),
    template: Template = { id: 'loaded-source', name: '', estimatedMinutes: 45, items },
    expected = independentSourceRampSeconds(items, profile, 45),
    before = structuredClone(template),
    out = refreshWarmupRamps(template, profile, r);
  expect(expected[0]).toBe(r.get('duration.ramp.sets').first_loaded_compound.ramp_s);
  expect(expected[1]).toBe(r.get('duration.ramp.sets').later_barbell_compound.ramp_s);
  expect(out.items.map(i => i.prescription!.warmupSeconds)).toEqual(expected);
  expect(sourceWarmupRamps(template, profile, r).map(row => row.scheme)).toEqual([
    r.get('session.warmup.ramp_sets').first_loaded_compound.scheme,
    r.get('session.warmup.ramp_sets').later_compounds.scheme,
  ]);
  expect(estimateSeconds(out, r) - estimateSeconds(template, r)).toBe(expected.reduce((a, b) => a + b, 0));
  expect(template).toEqual(before);
});
