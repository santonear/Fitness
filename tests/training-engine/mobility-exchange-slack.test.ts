import { expect, it } from 'vitest';
import { validatePlan } from '../../src/engine';
import { Rules } from '../../src/engine/data';
import { prescribe } from '../../src/engine/dose';
import { safety } from '../../src/engine/gates/strength-scoring';
import { scorePlan } from '../../src/engine/score';
import { estimateSeconds } from '../../src/engine/fit';
import type { EnginePlan } from '../../src/engine/contracts';
import type { SessionTemplate } from '../../src/domain/v8/contracts';
import originalDay from '../fixtures/training-engine/mobility20-available-exchange.json';
import frozenPlan from '../fixtures/training-engine/mobility6x90-682989c.json';
import { goldenProfiles } from '../../tools/eval/training-engine-profiles';
import { independentElapsedAllocation } from '../unit/engine/reference/training-engine-goal-share';
import { independentMobilityTempoIssues } from '../unit/engine/reference/training-engine-tempo';
const r = new Rules(),
  p = goldenProfiles.find(f => f.id === 'mobility6x90')!.profile;
function wrapped(t: SessionTemplate): EnginePlan {
  return {
    weeklyTarget: p.daysPerWeek,
    sessionMinutes: p.sessionMinutes,
    meta: { engineVersion: '2.0.0-test', rulesVersion: r.data.rulesVersion, seed: 'slack' },
    templates: [t],
    gates: [],
    notices: [],
    trace: [],
  };
}
it('retains all nine frozen invented cadence counterexamples as source target deficits and rejects actual zero loads', () => {
  const original = structuredClone(frozenPlan) as EnginePlan,
    corrected = structuredClone(original),
    before = structuredClone(original);
  expect(independentMobilityTempoIssues(original, p)).toHaveLength(9);
  for (const t of corrected.templates)
    for (const i of t.items) {
      const e = r.byExercise.get(i.exerciseId)!;
      if (
        e.modality !== 'strength' ||
        !['main', 'accessory'].includes(i.prescription?.block ?? '') ||
        !('reps' in i.target)
      )
        continue;
      const rx = prescribe(e, p, r, safety(p, r), i.prescription!.block as 'main' | 'accessory', i.sets).prescription!;
      i.prescription!.secondsPerRep = rx.secondsPerRep;
      i.prescription!.tempo = rx.tempo;
    }
  expect(independentMobilityTempoIssues(corrected, p)).toEqual([]);
  expect(
    scorePlan(corrected, p, r).perRule.find(row => row.id === 'goal.params.mobility')!.satisfaction,
  ).toBeGreaterThan(scorePlan(original, p, r).perRule.find(row => row.id === 'goal.params.mobility')!.satisfaction);
  expect(validatePlan(original, p).some(i => i.code === 'missing_load')).toBe(true);
  expect(original).toEqual(before);
});
it('measures real formal-day slack for a partial aerobic exchange without forcing a V1 repair strategy', () => {
  const day = structuredClone(originalDay) as SessionTemplate,
    before = structuredClone(day),
    chest = day.items.find(i => r.byExercise.get(i.exerciseId)?.slug === 'bench-chest-stretch')!,
    cardio = day.items.find(i => i.prescription?.block === 'conditioning')!;
  expect(chest.sets).toBe(3);
  expect('durationSeconds' in cardio.target).toBe(true);
  if (!('durationSeconds' in cardio.target)) throw Error('duration fixture');
  const actual = independentElapsedAllocation({ templates: [day] }).total,
    minimum = r.get('aerobic.bout.any_length').min_bout_minutes * 60,
    reserve = cardio.target.durationSeconds - minimum;
  chest.sets++;
  const added = independentElapsedAllocation({ templates: [day] }).total - actual;
  expect(added).toBeGreaterThan(reserve);
  cardio.target.durationSeconds = minimum;
  const next = independentElapsedAllocation({ templates: [day] }).total,
    high = day.targetMinutes! * 60 * r.get('duration.fit.bounds').duration_band[1];
  expect(next - actual).toBe(added - reserve);
  expect(next).toBeLessThanOrEqual(high);
  expect(estimateSeconds(day, r)).toBe(next);
  expect(
    validatePlan(wrapped(day), p).filter(i => i.code === 'duration_tolerance' || i.code === 'stretch_dose_bounds'),
  ).toEqual([]);
  expect(day.targetMinutes).toBe(before.targetMinutes);
});
it('separates the preferred duration boundary from the true hard overrun after a source set increment', () => {
  const day = structuredClone(originalDay) as SessionTemplate,
    cardio = day.items.find(i => i.prescription?.block === 'conditioning')!;
  if (!('durationSeconds' in cardio.target)) throw Error('duration fixture');
  cardio.target.durationSeconds = r.get('aerobic.bout.any_length').min_bout_minutes * 60 + 1;
  for (const [slug, hold] of [
    ['custom-standing-upper-back-stretch', 22],
    ['cross-body-shoulder-stretch', 10],
    ['standing-quad-stretch', 10],
  ] as const) {
    const e = r.data.exercises.find(e => e.slug === slug)!,
      i = prescribe(e, p, r, safety(p, r), 'mobility', r.get('dose.stretch').reps_per_muscle[0]);
    i.target = { metricType: 'duration', durationSeconds: hold };
    day.items.push(i);
  }
  const softHigh = day.targetMinutes! * 60 * r.get('duration.fit.tolerance').band[1],
    hardHigh = day.targetMinutes! * 60 * r.get('duration.fit.bounds').duration_band[1];
  expect(independentElapsedAllocation({ templates: [day] }).total).toBe(softHigh);
  const trial = structuredClone(day),
    chest = trial.items.find(i => r.byExercise.get(i.exerciseId)?.slug === 'bench-chest-stretch')!,
    aerobic = trial.items.find(i => i.prescription?.block === 'conditioning')!;
  chest.sets++;
  if (!('durationSeconds' in aerobic.target)) throw Error('duration fixture');
  aerobic.target.durationSeconds = r.get('aerobic.bout.any_length').min_bout_minutes * 60;
  const actual = independentElapsedAllocation({ templates: [trial] }).total;
  expect(actual).toBeGreaterThan(softHigh);
  expect(actual).toBeLessThanOrEqual(hardHigh);
  expect(validatePlan(wrapped(trial), p).some(i => i.code === 'duration_tolerance')).toBe(false);
  expect(
    scorePlan(wrapped(trial), p, r).perRule.find(row => row.id === 'duration.fit.tolerance')!.satisfaction,
  ).toBeLessThan(scorePlan(wrapped(day), p, r).perRule.find(row => row.id === 'duration.fit.tolerance')!.satisfaction);
  aerobic.target.durationSeconds += hardHigh - actual + 1;
  expect(estimateSeconds(trial, r)).toBe(hardHigh + 1);
  expect(validatePlan(wrapped(trial), p).some(i => i.code === 'duration_tolerance' && i.severity === 'error')).toBe(
    true,
  );
  expect(trial.targetMinutes).toBe(day.targetMinutes);
});
