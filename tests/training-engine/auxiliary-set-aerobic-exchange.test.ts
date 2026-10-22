import { expect, it } from 'vitest';
import { generatePlan, validatePlan } from '../../src/engine';
import { Rules } from '../../src/engine/data';
import { scorePlan } from '../../src/engine/score';
import { goldenProfiles } from '../../tools/eval/training-engine-profiles';
import {
  independentElapsedAllocation,
  independentDurationIssues,
} from '../unit/engine/reference/training-engine-goal-share';
import { externalIssues } from '../../tools/eval/training-engine-invariants';
const r = new Rules();
it('checks actual introductory work and aerobic allocation without requiring a removed V1 exchange trace', () => {
  const p = goldenProfiles.find(x => x.id === 'first-week-health2x20')!.profile,
    plan = generatePlan(p),
    facts = independentElapsedAllocation(plan);
  expect(facts.resistance).toBeGreaterThan(0);
  expect(scorePlan(plan, p, r).perRule.find(row => row.id === 'aerobic.target.weekly')!.satisfaction).toBe(
    Math.min(1, facts.aerobic / 60 / r.get('aerobic.target.weekly').moderate_equiv_min_week),
  );
  expect(facts.total).toBeGreaterThan(0);
  expect(independentDurationIssues(plan, p)).toEqual([]);
  expect(validatePlan(plan, p)).toEqual([]);
  expect(externalIssues(plan, p).filter(issue => issue.severity === 'error')).toEqual([]);
  const goal = scorePlan(plan, p, r).perRule.find(row => row.id === 'goal.params.health')!;
  expect(goal).toBeDefined();
  expect(goal.satisfaction).toBeGreaterThanOrEqual(0);
  expect(goal.satisfaction).toBeLessThanOrEqual(1);
  for (const item of plan.templates.flatMap(t =>
    t.items.filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? '')),
  )) {
    expect(item.sets).toBeGreaterThanOrEqual(r.get('progression.new.week_caps').week_1.sets_per_exercise[0]);
    expect(item.sets).toBeLessThanOrEqual(r.get('progression.new.week_caps').week_1.sets_per_exercise[1]);
  }
});
it('reports actual quiet-plan muscle-volume gaps as targets while preserving independent hard caps', () => {
  const p = goldenProfiles.find(x => x.id === 'quiet-bodyweight-2x20')!.profile,
    plan = generatePlan(p),
    before = JSON.stringify(plan),
    row = scorePlan(plan, p, r).perRule.find(row => row.id === 'dose.sets_week.goal_matrix')!;
  expect(row.satisfaction).toBeGreaterThanOrEqual(0);
  expect(row.satisfaction).toBeLessThan(1);
  expect(validatePlan(plan, p)).toEqual([]);
  const emptyWork = structuredClone(plan);
  for (const t of emptyWork.templates)
    t.items = t.items.filter(i => !['main', 'accessory'].includes(i.prescription?.block ?? ''));
  expect(
    scorePlan(emptyWork, p, r).perRule.find(row => row.id === 'dose.sets_week.goal_matrix')!.satisfaction,
  ).toBeLessThan(row.satisfaction);
  const excess = structuredClone(plan),
    item = excess.templates
      .flatMap(t => t.items)
      .find(i => ['main', 'accessory'].includes(i.prescription?.block ?? ''))!;
  item.sets = 999;
  expect(validatePlan(excess, p).some(issue => issue.code === 'exercise_set_cap')).toBe(true);
  expect(JSON.stringify(plan)).toBe(before);
});
