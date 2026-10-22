import { expect, it } from 'vitest';
import { Rules } from '../../../src/engine/data';
import { prescribe, type Template } from '../../../src/engine/dose';
import { runGates } from '../../../src/engine/gates';
import {
  foldGeneratedBodyweightWarmup,
  realizeBodyweightWarmup,
  isRealizedBodyweightWarmup,
  sourceWarmupRamps,
} from '../../../src/engine/source-warmup';
import { estimateSeconds } from '../../../src/engine/fit';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
const r = new Rules(),
  p = baseProfile({ goal: 'mobility', trainingAgeWeeks: 52, sessionMinutes: 30 }),
  gate = runGates(p, r);
function fixture() {
  const main = prescribe(
    r.data.exercises.find(e => e.slug === 'bodyweight-squat')!,
    p,
    r,
    gate.restrictions,
    'main',
    3,
  );
  main.target = { metricType: 'reps', reps: 8 };
  main.prescription!.sourcePosition = 'source-day-M1-main_1';
  const warm = prescribe(
    r.data.exercises.find(e => e.slug === 'chair-pose')!,
    p,
    r,
    gate.restrictions,
    'warmup',
    1,
  );
  warm.target = { metricType: 'duration', durationSeconds: 15 };
  warm.prescription!.sourcePosition = 'source-day-WU3';
  return { id: 'source-day', name: 'source', estimatedMinutes: 30, items: [warm, main] } as Template;
}
it('replaces the actual unrelated chair-pose placeholder with the source one-set half-repetition squat, once', () => {
  const t = fixture(),
    before = structuredClone(t),
    ramp = sourceWarmupRamps(t, p, r)[0];
  expect(ramp.seconds).toBe(26);
  expect(isRealizedBodyweightWarmup(t, 0, p, r)).toBe(false);
  const out = realizeBodyweightWarmup(t, p, r);
  expect(out.items).toHaveLength(2);
  expect(out.items[0].exerciseId).toBe(t.items[1].exerciseId);
  expect(out.items[0].sets).toBe(r.get('session.warmup.ramp_sets').bodyweight_main.sets);
  expect(out.items[0].target).toEqual({ metricType: 'reps', reps: 4 });
  expect(out.items[0].prescription).toMatchObject({
    block: 'warmup',
    sourcePosition: 'source-day-WU3',
    secondsPerRep: 4,
    structure: 'straight',
  });
  expect(out.items[0].prescription?.tempo).toEqual(t.items[1].prescription?.tempo);
  expect(isRealizedBodyweightWarmup(out, 0, p, r)).toBe(true);
  expect(out.items[1]).toEqual(t.items[1]);
  expect(estimateSeconds(out, r) - estimateSeconds(t, r)).toBe(
    26 - (15 + r.get('duration.set.overhead').overhead_s_per_set),
  );
  expect(t).toEqual(before);
  expect(realizeBodyweightWarmup(out, p, r)).toEqual(out);
});
it('drops only the exact inherited implicit ramp after real takeover and never carries working group metadata into the warmup', () => {
  const t = fixture();
  Object.assign(t.items[1].prescription!, {
    structure: 'circuit',
    groupId: 'working',
    roundRestSeconds: 60,
    warmupSeconds: 26,
  });
  const out = realizeBodyweightWarmup(t, p, r);
  expect(isRealizedBodyweightWarmup(out, 0, p, r)).toBe(true);
  expect(out.items[0].prescription?.groupId).toBeUndefined();
  expect(out.items[0].prescription?.roundRestSeconds).toBeUndefined();
  expect(out.items[1].prescription?.warmupSeconds).toBeUndefined();
  expect(out.items[1].prescription?.groupId).toBe('working');
  const unknown = fixture();
  unknown.items[1].prescription!.warmupSeconds = 999;
  expect(realizeBodyweightWarmup(unknown, p, r).items[1].prescription?.warmupSeconds).toBe(999);
});
it.each([
  'position',
  'order',
  'sets',
  'reps',
  'load',
  'group',
  'round-rest',
  'cadence',
  'side',
  'unrelated',
  'main-position',
] as const)('recomputes the source exception and rejects forged %s', kind => {
  const t = realizeBodyweightWarmup(fixture(), p, r),
    w = t.items[0],
    main = t.items[1];
  if (kind === 'position') w.prescription!.sourcePosition = 'somewhere-WU3';
  if (kind === 'order') t.items = [main, w];
  if (kind === 'sets') w.sets = 2;
  if (kind === 'reps') w.target = { metricType: 'reps', reps: 5 };
  if (kind === 'load') w.target = { metricType: 'reps_load', reps: 4, loadGrams: 1000 };
  if (kind === 'group') w.prescription!.groupId = 'hidden';
  if (kind === 'round-rest') w.prescription!.roundRestSeconds = 60;
  if (kind === 'cadence') w.prescription!.secondsPerRep = 5;
  if (kind === 'side') w.prescription!.perSide = true;
  if (kind === 'unrelated') w.exerciseId = r.data.exercises.find(e => e.slug === 'chair-pose')!.id;
  if (kind === 'main-position') main.prescription!.sourcePosition = 'source-day-M1-main_2';
  expect(isRealizedBodyweightWarmup(t, kind === 'order' ? 1 : 0, p, r)).toBe(false);
});
it('keeps unknown source slots and loaded main protocols unchanged instead of claiming realization', () => {
  const unknown = fixture();
  unknown.items[0].prescription!.sourcePosition = 'unregistered-placeholder';
  expect(realizeBodyweightWarmup(unknown, p, r)).toEqual(unknown);
  const loaded = fixture(),
    e = r.data.exercises.find(
      e => e.modality === 'strength' && e.metricType === 'reps_load' && e.equipment_required.includes('dumbbell'),
    )!;
  loaded.items[1] = prescribe(e, p, r, gate.restrictions, 'main', 3);
  loaded.items[1].prescription!.sourcePosition = 'source-day-M1-main_1';
  expect(realizeBodyweightWarmup(loaded, p, r)).toEqual(loaded);
});

it('rejects duplicate representations of the same authored ramp slot', () => {
  const t = realizeBodyweightWarmup(fixture(), p, r),
    extra = structuredClone(t.items[0]);
  extra.prescription!.sourcePosition = 'WU3';
  t.items.unshift(extra);
  expect(isRealizedBodyweightWarmup(t, 0, p, r)).toBe(false);
  expect(isRealizedBodyweightWarmup(t, 1, p, r)).toBe(false);
});

it('folds the wrong generated placeholder into the existing main with the exact four-rep source guidance and one 26-second cost', () => {
  const t = fixture(),
    before = structuredClone(t),
    out = foldGeneratedBodyweightWarmup(t, p, r),
    realized = realizeBodyweightWarmup(t, p, r);
  expect(out.items).toHaveLength(1);
  expect(out.items[0].exerciseId).toBe(t.items[1].exerciseId);
  expect(out.items[0].prescription?.sourcePosition).toBe(t.items[1].prescription?.sourcePosition);
  expect(out.items[0].prescription?.warmupSeconds).toBe(26);
  expect(sourceWarmupRamps(out, p, r)[0].scheme).toEqual([{ reps: 4 }]);
  expect(estimateSeconds(out, r)).toBe(estimateSeconds(realized, r));
  expect(estimateSeconds(out, r) - estimateSeconds(t, r)).toBe(1);
  expect(t).toEqual(before);
  expect(foldGeneratedBodyweightWarmup(out, p, r)).toEqual(out);
});
it('removes only the folded draft slot so optional fitting cannot reinsert the wrong placeholder', () => {
  const t = {
      ...fixture(),
      slots: [
        {
          id: 'source-day-WU3',
          role: 'warmup' as const,
          patterns: ['squat' as const],
          priority: 1,
          optional: true,
          sourceRuleId: 'session.template.min30',
        },
        {
          id: 'source-day-M1-main_1',
          role: 'main' as const,
          patterns: ['squat' as const],
          priority: 1,
          optional: false,
          sourceRuleId: 'week.day.fb_a',
        },
      ],
    },
    before = structuredClone(t),
    out = foldGeneratedBodyweightWarmup(t, p, r);
  expect(out.slots).toEqual([t.slots[1]]);
  expect(t).toEqual(before);
});
it('does not fold retained realized items or unknown implicit costs into a new representation', () => {
  const realized = realizeBodyweightWarmup(fixture(), p, r);
  expect(foldGeneratedBodyweightWarmup(realized, p, r)).toEqual(realized);
  const unknown = fixture();
  unknown.items[1].prescription!.warmupSeconds = 999;
  expect(foldGeneratedBodyweightWarmup(unknown, p, r)).toEqual(unknown);
});
