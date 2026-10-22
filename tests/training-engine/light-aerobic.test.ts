import { it, expect } from 'vitest';
import { generatePlan, validatePlan } from '../../src/engine';
import { Rules } from '../../src/engine/data';
import { scorePlan } from '../../src/engine/score';
import { prescribe, straightRestFloor } from '../../src/engine/dose';
import { runGates } from '../../src/engine/gates';
import { baseProfile, equipmentScenarios } from '../../tools/eval/training-engine-profiles';
import { externalIssues } from '../../tools/eval/training-engine-invariants';
import { independentElapsedAllocation } from '../unit/engine/reference/training-engine-goal-share';
import {
  independentWarmupAudit,
  independentlyApplicableSessionTypes,
} from '../unit/engine/reference/training-engine-session-time';
const r = new Rules();
it('generates safe real sessions without requiring a separate aerobic-day factory structure', () => {
  const p = baseProfile({ equipment: [...equipmentScenarios[3]] }),
    before = structuredClone(p),
    plan = generatePlan(p);
  expect(plan.templates.length).toBeGreaterThan(0);
  expect(plan.templates.some(t => t.items.some(i => i.prescription?.block === 'main'))).toBe(true);
  const cardio = plan.templates.flatMap(t => t.items).filter(i => i.prescription?.block === 'conditioning');
  for (const i of cardio) {
    expect(i.prescription?.targetRpe).toBeDefined();
    expect('durationSeconds' in i.target && i.target.durationSeconds).toBeGreaterThan(0);
  }
  for (const t of plan.templates)
    expect(independentElapsedAllocation({ templates: [t] }).total).toBeCloseTo(t.estimatedSeconds!, 6);
  expect(validatePlan(plan, p).filter(i => i.severity === 'error')).toEqual([]);
  expect(externalIssues(plan, p)).toEqual([]);
  expect(p).toEqual(before);
});
function fixture() {
  const p = baseProfile({ constraints: { noJump: false, quiet: false, space: 'large' } }),
    plan = generatePlan(p),
    e = r.data.exercises.find(e => e.slug === 'walking')!,
    item = prescribe(e, p, r, runGates(p, r).restrictions, 'conditioning', 1);
  item.target = { metricType: 'duration_distance', durationSeconds: 120 };
  plan.templates = [{ ...plan.templates[0], items: [item] }];
  return { p, plan, t: plan.templates[0], item };
}
it('distinguishes explicit light, moderate and actual circuit prescriptions while measuring all real seconds', () => {
  const { p, plan, t, item } = fixture(),
    light = r.get('aerobic.intensity.rpe_scale').light_max,
    moderate = r.get('aerobic.intensity.rpe_scale').moderate;
  item.prescription!.targetRpe = [light, light];
  expect(independentlyApplicableSessionTypes(t, p)).toEqual([]);
  expect(independentElapsedAllocation(plan).aerobic).toBe(120);
  expect(scorePlan(plan, p, r).perRule.some(v => v.id === 'safety.session.warmup_cooldown')).toBe(false);
  item.prescription!.targetRpe = [...moderate] as [number, number];
  expect(independentlyApplicableSessionTypes(t, p)).toContain('aerobic_moderate_plus');
  expect(independentElapsedAllocation(plan).aerobic).toBe(120);
  expect(scorePlan(plan, p, r).perRule.find(v => v.id === 'safety.session.warmup_cooldown')!.satisfaction).toBe(0);
  item.prescription!.targetRpe = [light, light];
  item.prescription!.structure = 'circuit';
  item.prescription!.groupId = 'real-light-circuit';
  expect(independentlyApplicableSessionTypes(t, p)).toEqual(['circuit']);
  expect(independentElapsedAllocation(plan).total).toBe(120);
  expect(scorePlan(plan, p, r).perRule.find(v => v.id === 'safety.session.warmup_cooldown')!.satisfaction).toBe(0);
  expect(validatePlan(plan, p).some(i => i.ruleId === 'safety.session.warmup_cooldown')).toBe(false);
});
it('cannot fake ramp time or working rest to repair a circuit target shortfall', () => {
  const { p, plan, t, item } = fixture();
  item.prescription!.structure = 'circuit';
  item.prescription!.warmupSeconds = r.get('duration.ramp.sets').first_loaded_compound.ramp_s;
  expect(independentWarmupAudit(t, p).seconds).toBe(0);
  expect(validatePlan(plan, p).some(i => i.code === 'unverified_ramp_time' && i.severity === 'error')).toBe(true);
  const e = r.data.exercises.find(e => e.slug === 'bodyweight-squat')!,
    work = prescribe(e, p, r, runGates(p, r).restrictions, 'main', 2);
  work.prescription!.restSeconds = straightRestFloor(e, p, r, 'main') - 1;
  t.items = [work];
  expect(validatePlan(plan, p).some(i => i.code === 'rest_floor' && i.severity === 'error')).toBe(true);
});
