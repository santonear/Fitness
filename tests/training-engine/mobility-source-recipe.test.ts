import { verifyObservedGoalShares } from './v2-quality-observation';
import { scorePlan } from '../../src/engine/score';
import { expect, it } from 'vitest';
import { generatePlan, validatePlan } from '../../src/engine';
import { Rules } from '../../src/engine/data';
import { baseProfile, equipmentScenarios, goldenProfiles } from '../../tools/eval/training-engine-profiles';
import { independentTemplateTarget } from '../unit/engine/reference/training-engine-template-target';
import { independentlyApplicableSessionTypes } from '../unit/engine/reference/training-engine-session-time';
import {
  independentElapsedAllocation,
  independentGoalShareIssues,
} from '../unit/engine/reference/training-engine-goal-share';
const r = new Rules(),
  p = goldenProfiles.find(f => f.id === 'mobility6x90')!.profile;
it('independently checks the full pure mobility recipe and keeps missing weekly aerobic share visible', () => {
  const plan = generatePlan(p),
    day = r.get('week.day.mobility'),
    formal = plan.templates.filter(t => t.items.some(i => i.prescription?.sourcePosition?.endsWith('-mob_1'))),
    map = r.get('dose.muscle_groups').catalog_map,
    hold = r.get('dose.stretch').hold_s.range,
    sets = r.get('dose.stretch').reps_per_muscle;
  expect(formal).toHaveLength(
    p.daysPerWeek - Math.min(p.daysPerWeek, r.get('goal.params.mobility').rt_sessions_week.max),
  );
  for (const t of formal) {
    expect(t.targetMinutes).toBe(p.sessionMinutes);
    expect(t.items.some(i => i.prescription?.block === 'mobility')).toBe(true);
    const actual: Record<string, number> = {},
      staticSets: Record<string, number> = {};
    for (const i of t.items) {
      const e = r.byExercise.get(i.exerciseId)!;
      if (e.mobility_type === 'static') {
        expect('durationSeconds' in i.target).toBe(true);
        if ('durationSeconds' in i.target) {
          expect(i.target.durationSeconds).toBeGreaterThanOrEqual(Math.max(hold[0], e.stretch_hold_s?.[0] ?? hold[0]));
          expect(i.target.durationSeconds).toBeLessThanOrEqual(Math.min(hold[1], e.stretch_hold_s?.[1] ?? hold[1]));
        }
        expect(i.sets).toBeGreaterThanOrEqual(sets[0]);
        for (const g of e.stretch_targets ?? []) staticSets[g] = (staticSets[g] ?? 0) + i.sets;
      }
      if (i.prescription?.block !== 'mobility') continue;
      expect('durationSeconds' in i.target).toBe(true);
      if (!('durationSeconds' in i.target)) continue;
      const groups = e.stretch_targets ?? [],
        regions = [
          ...(e.mobility_type === 'static' && groups.some(g => ['quads', 'glutes', 'hamstrings'].includes(g))
            ? ['lower_body']
            : []),
          ...(e.mobility_type === 'static' && groups.some(g => ['chest', 'back', 'shoulders'].includes(g))
            ? ['upper_body']
            : []),
          ...(e.mobility_type === 'dynamic' &&
          (e.primaryMuscles ?? []).some(m => ['core', 'lower_back'].includes(map[m]))
            ? ['trunk']
            : []),
        ],
        work =
          i.sets *
          i.target.durationSeconds *
          (i.prescription?.perSide || e.time.per_side ? r.get('session.time.model').per_side_multiplier : 1);
      for (const region of regions) actual[region] = (actual[region] ?? 0) + work;
    }
    for (const groupSets of Object.values(staticSets)) expect(groupSets).toBeLessThanOrEqual(sets[1]);
    for (const slot of day.slots.filter((s: { target?: string }) => s.target))
      expect(actual[slot.target] ?? 0).toBeGreaterThanOrEqual(day.seconds_per_region_min);
  }
  verifyObservedGoalShares(plan, p, r);
  expect(validatePlan(plan, p).filter(i => i.severity === 'error')).toEqual([]);
  // The source weekly constraint survives independently of any future successful RT repair.
  const missing = structuredClone(plan);
  for (const t of missing.templates)
    t.items = t.items.filter(i => r.byExercise.get(i.exerciseId)?.modality !== 'cardio');
  expect(independentElapsedAllocation(missing).aerobic).toBe(0);
  expect(
    independentGoalShareIssues(missing, p).some(
      i => i.code === 'external_goal_time_share' && i.severity === 'error' && i.reason.startsWith('aerobic:'),
    ),
  ).toBe(true);
  verifyObservedGoalShares(missing, p, r);
  expect(scorePlan(missing, p, r).perRule.find(row => row.id === 'aerobic.target.weekly')!.satisfaction).toBe(0);
});
it('keeps the existing other-goal mobility-day path scoped separately from the pure goal-mobility recipe', () => {
  const profile = baseProfile({
      goal: 'health',
      daysPerWeek: 6,
      sessionMinutes: 45,
      equipment: [...equipmentScenarios[3]],
    }),
    plan = generatePlan(profile),
    other = plan.templates.filter(t => t.items.some(i => i.prescription?.block === 'mobility'));
  expect(other.length).toBeGreaterThan(0);
  expect(
    other.some(
      t => t.targetMinutes === profile.sessionMinutes && t.items.some(i => i.prescription?.block === 'conditioning'),
    ),
  ).toBe(true);
});
