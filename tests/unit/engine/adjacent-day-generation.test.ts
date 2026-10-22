import { expect, it } from 'vitest';
import { generatePlan, validatePlan, modifyPlan } from '../../../src/engine';
import { requiresAlternatingDay, Rules } from '../../../src/engine/data';
import { baseProfile } from '../../../tools/eval/training-engine-profiles';
const r = new Rules();
function ordinary(days: ['tue', 'wed'] | ['sun', 'mon'] = ['tue', 'wed']) {
  return baseProfile({
    level: 'intermediate',
    trainingAgeWeeks: 52,
    daysPerWeek: 2,
    preferredDays: days,
    equipment: ['none', 'dumbbell', 'barbell', 'pull-up-bar', 'flat-bench'],
    constraints: { noJump: false, quiet: false, space: 'large' },
  });
}
function postpartum() {
  return baseProfile({
    daysPerWeek: 2,
    preferredDays: ['tue', 'wed'],
    equipment: ['none'],
    population: { kind: 'postpartum', weeksSinceBirth: 1, delivery: 'cesarean', cleared: false },
    constraints: { noJump: true, quiet: true, space: 'large' },
  });
}
it('cesarean phase one on Tuesday and Wednesday generates two low-intensity walking classes', () => {
  const p = postpartum(),
    plan = generatePlan(p);
  expect(plan.templates.map(t => t.weekday)).toEqual(['tue', 'wed']);
  expect(plan.templates).toHaveLength(2);
  for (const t of plan.templates) {
    expect(t.items).toHaveLength(1);
    const item = t.items[0];
    expect(r.byExercise.get(item.exerciseId)?.slug).toBe('walking');
    expect(requiresAlternatingDay(item, r)).toBe(false);
    expect(item.prescription?.targetRpe?.[1]).toBeLessThanOrEqual(r.get('aerobic.intensity.rpe_scale').moderate[1]);
  }
  expect(validatePlan(plan, p)).toEqual([]);
});
it('ordinary adjacent training dates do not repeat strength exercises', () => {
  const p = ordinary(),
    plan = generatePlan(p);
  expect(plan.templates).toHaveLength(2);
  const [first, second] = plan.templates;
  const ids = new Set(first.items.filter(item => requiresAlternatingDay(item, r)).map(item => item.exerciseId));
  expect(first.items.some(item => requiresAlternatingDay(item, r))).toBe(true);
  expect(second.items.some(item => requiresAlternatingDay(item, r))).toBe(true);
  expect(second.items.filter(item => requiresAlternatingDay(item, r) && ids.has(item.exerciseId))).toEqual([]);
  expect(validatePlan(plan, p)).toEqual([]);
  const repeated = first.items.find(item => requiresAlternatingDay(item, r))!,
    bad = structuredClone(plan);
  bad.templates[1].items.push(structuredClone(repeated));
  expect(validatePlan(bad, p)).toContainEqual(
    expect.objectContaining({ code: 'adjacent_exercise', ruleId: 'variety.no_repeat', severity: 'error' }),
  );
  bad.templates[0].weekday = 'sun';
  bad.templates[1].weekday = 'mon';
  expect(validatePlan(bad, p).some(issue => issue.code === 'adjacent_exercise')).toBe(true);
  bad.templates[1].weekday = 'tue';
  expect(validatePlan(bad, p).some(issue => issue.code === 'adjacent_exercise')).toBe(false);
});
it('one class still rejects duplicate actions including low-intensity walking', () => {
  const p = postpartum(),
    plan = generatePlan(p);
  plan.templates[0].items.push(structuredClone(plan.templates[0].items[0]));
  expect(validatePlan(plan, p)).toContainEqual(
    expect.objectContaining({ code: 'duplicate_exercise', ruleId: 'variety.no_repeat', severity: 'error' }),
  );
});
it('whole-plan modifications preserve known weekdays and adjacent-day safety', () => {
  const p = ordinary(['sun', 'mon']),
    plan = generatePlan(p),
    template = plan.templates[1],
    index = template.items.findIndex(item => requiresAlternatingDay(item, r)),
    before = JSON.stringify(plan);
  expect(index).toBeGreaterThanOrEqual(0);
  for (const change of [
    { op: 'replace' as const, templateId: template.id, itemIndex: index },
    { op: 'shorten' as const, templateId: template.id, minutes: 20 },
  ]) {
    const out = modifyPlan(plan, p, [change]);
    expect(out.value.templates.map(t => t.weekday)).toEqual(plan.templates.map(t => t.weekday));
    expect(validatePlan(out.value, p).filter(issue => issue.ruleId === 'variety.no_repeat')).toEqual([]);
  }
  expect(JSON.stringify(plan)).toBe(before);
});
