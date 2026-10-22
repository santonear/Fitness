import { expect, it } from 'vitest';
import type { EnginePlan } from '../../src/engine/contracts';
import catalog from '../../src/engine/generated/exercise-index.json';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import { independentlyRepeatedExerciseIds, rampRepeatSource } from './reference/independent-ramp-repeat';
const profile = baseProfile({ daysPerWeek: 2, sessionMinutes: 30, trainingAgeWeeks: 52 });
function fixture() {
  const e = catalog.exercises.find(e => e.slug === 'bodyweight-squat')!,
    main: EnginePlan['templates'][number]['items'][number] = {
      exerciseId: e.id,
      equipment: 'none',
      sets: 2,
      target: { metricType: 'reps', reps: 10 },
      prescription: {
        pattern: e.primary_pattern as 'squat',
        block: 'main',
        sourcePosition: 'main_1',
        rir: [3, 4],
        restSeconds: 90,
        structure: 'straight',
        secondsPerRep: 3,
      },
    },
    warm = structuredClone(main);
  warm.sets = 1;
  warm.target = { metricType: 'reps', reps: 5 };
  warm.prescription!.block = 'warmup';
  warm.prescription!.sourcePosition = 'WU3';
  warm.prescription!.restSeconds = 0;
  return { id: 'manual-ramp', name: 'Manual ramp', estimatedMinutes: 30, items: [warm, main] };
}
it('accepts only a re-proven same-ID source warmup while preserving unique working identities', () => {
  const t = fixture();
  expect(independentlyRepeatedExerciseIds(t, profile)).toEqual([]);
  t.items[1].target = { metricType: 'reps', reps: 11 };
  t.items[0].target = { metricType: 'reps', reps: 6 };
  expect(independentlyRepeatedExerciseIds(t, profile)).toEqual([]);
});
it('recognizes positions scoped to the actual template and the matching authored ramp slot', () => {
  const t = fixture();
  t.items[0].prescription!.sourcePosition = t.id + '-WU3';
  t.items[1].prescription!.sourcePosition = t.id + '-M1-main_1';
  expect(independentlyRepeatedExerciseIds(t, profile)).toEqual([]);
});
it.each([
  'sets',
  'reps',
  'load',
  'group',
  'round_rest',
  'embedded_ramp',
  'role',
  'warm_slot',
  'main_slot',
  'order',
  'cadence',
  'side',
  'tempo',
  'pattern',
] as const)('does not exempt a forged warmup: %s', mode => {
  const t = fixture(),
    warm = t.items[0],
    main = t.items[1];
  if (mode === 'sets') warm.sets = 2;
  if (mode === 'reps') warm.target = { metricType: 'reps', reps: 4 };
  if (mode === 'load') warm.target = { metricType: 'reps_load', reps: 5, loadGrams: 1000 };
  if (mode === 'group') warm.prescription!.groupId = 'forged';
  if (mode === 'round_rest') warm.prescription!.roundRestSeconds = 60;
  if (mode === 'embedded_ramp') warm.prescription!.warmupSeconds = 99;
  if (mode === 'role') warm.prescription!.block = 'accessory';
  if (mode === 'warm_slot') warm.prescription!.sourcePosition = 'not-a-ramp';
  if (mode === 'main_slot') main.prescription!.sourcePosition = 'unrelated-template-M1-main_1';
  if (mode === 'order') t.items.reverse();
  if (mode === 'cadence') warm.prescription!.secondsPerRep = 4;
  if (mode === 'side') warm.prescription!.perSide = true;
  if (mode === 'tempo') warm.prescription!.tempo = { eccentricSeconds: 3, concentricSeconds: 1, pauseSeconds: 0 };
  if (mode === 'pattern') warm.prescription!.pattern = 'hinge';
  expect(independentlyRepeatedExerciseIds(t, profile)).toContain(main.exerciseId);
});
it('does not let source flags alone exempt a duplicate work item or a warmup when the source exception is disabled', () => {
  const t = fixture();
  t.items.push(structuredClone(t.items[1]));
  expect(independentlyRepeatedExerciseIds(t, profile)).toContain(t.items[1].exerciseId);
  const disabled = structuredClone(rampRepeatSource);
  disabled['variety.no_repeat'].ramp_sets_exempt = false;
  expect(independentlyRepeatedExerciseIds(fixture(), profile, disabled)).toEqual([t.items[1].exerciseId]);
});
it('does not exempt a second same-source warmup, arbitrary warmup duplicates or unrelated auxiliary duplicates', () => {
  const t = fixture();
  t.items.unshift(structuredClone(t.items[0]));
  expect(independentlyRepeatedExerciseIds(t, profile)).toContain(t.items[0].exerciseId);
  const arbitrary = fixture();
  arbitrary.items[0].prescription!.sourcePosition = 'WU1';
  expect(independentlyRepeatedExerciseIds(arbitrary, profile)).toContain(arbitrary.items[0].exerciseId);
  const aux = fixture();
  aux.items[0].prescription!.block = 'accessory';
  aux.items[1].prescription!.block = 'accessory';
  expect(independentlyRepeatedExerciseIds(aux, profile)).toContain(aux.items[0].exerciseId);
});
it('rejects an invented main container even when its suffix and same-template prefix look plausible', () => {
  const t = fixture();
  t.items[1].prescription!.sourcePosition = t.id + '-invented-main_1';
  expect(independentlyRepeatedExerciseIds(t, profile)).toEqual([t.items[1].exerciseId]);
});
it('requires a real source-day main pattern rather than trusting labels on a duplicate pair', () => {
  const t = fixture(),
    e = catalog.exercises.find(
      e =>
        e.modality === 'strength' &&
        e.metricType === 'reps' &&
        e.nsca_class === 'compound' &&
        e.primary_pattern === 'push_horizontal' &&
        e.equipment_required.every(key => key === 'none') &&
        e.use.includes('warmup'),
    )!;
  for (const item of t.items) {
    item.exerciseId = e.id;
    item.prescription!.pattern = 'push_horizontal';
  }
  expect(independentlyRepeatedExerciseIds(t, profile)).toEqual([e.id]);
});
