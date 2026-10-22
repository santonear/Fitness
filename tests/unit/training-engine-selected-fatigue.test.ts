import { describe, expect, it } from 'vitest';
import { generatePlan, nextTargets, validatePlan } from '../../src/engine';
import { Rules } from '../../src/engine/data';
import { scorePlan } from '../../src/engine/score';
import { baseProfile, equipmentScenarios } from '../../tools/eval/training-engine-profiles';

describe('introductory fatigue targets the workout actually selected', () => {
  it('reduces the selected second workout without rewriting the first', () => {
    const profile = baseProfile({ trainingAgeWeeks: 0, equipment: [...equipmentScenarios[3]] });
    const baseline = generatePlan(profile);
    expect(baseline.templates.length).toBeGreaterThan(1);
    const selectedIndex = baseline.templates.findIndex(
      (t, index) => index > 0 && t.items.some(i => i.prescription?.block === 'main' && i.sets > 1),
    );
    expect(selectedIndex).toBeGreaterThan(0);
    const templateId = baseline.templates[selectedIndex].id;
    const checkin = {
      poorSleepNights: new Rules().get('deload.trigger.reactive').flags.poor_sleep.nights_sum_gte,
      newOrWorseJointPain: true,
    };
    const result = nextTargets([], baseline, profile, { checkin, templateId });
    const reductions = result.suggestions.filter(s => s.ruleId === 'deload.dose.prescription');
    expect(reductions.length).toBeGreaterThan(0);
    expect(reductions.every(s => s.templateId === templateId)).toBe(true);
    expect(result.value.templates[0].items).toEqual(baseline.templates[0].items);
    expect(
      result.value.templates[selectedIndex].items.some(
        (item, index) => item.sets < baseline.templates[selectedIndex].items[index].sets,
      ),
    ).toBe(true);
    const context = { progression: { baseline, history: [], checkin, templateId } };
    const rows = scorePlan(result.value, profile).perRule.filter(row =>
      ['dose.sets_week.beginner', 'dose.sets_week.goal_matrix', 'progression.new.weekly_sets'].includes(row.id),
    );
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.some(row => row.satisfaction < 1)).toBe(true);
    expect(validatePlan(result.value, profile, context)).toEqual(validatePlan(result.value, profile));
    const forged = structuredClone(result.value),
      work = forged.templates[0].items.find(i => i.prescription?.block === 'main')!;
    work.sets = new Rules().get('duration.fit.bounds').sets_per_exercise_max[profile.level] + 1;
    expect(
      validatePlan(forged, profile, context).some(i => i.code === 'exercise_set_cap' && i.severity === 'error'),
    ).toBe(true);
  });
});

it('measures short-stretch target loss and keeps only approved notices within the three-message limit', () => {
  const profile = baseProfile({ trainingAgeWeeks: 0, equipment: [...equipmentScenarios[3]] }),
    r = new Rules(),
    plan = generatePlan(profile),
    row = scorePlan(plan, profile, r).perRule.find(row => row.id === 'session.cooldown.stretch');
  expect(row).toBeDefined();
  expect(row!.satisfaction).toBeLessThan(1);
  const source = r.get('session.cooldown.stretch'),
    groupMap = r.get('dose.muscle_groups').catalog_map;
  const shortfalls = plan.templates.flatMap(template => {
    const trained = new Set(
      template.items
        .filter(i => ['main', 'accessory'].includes(i.prescription?.block ?? ''))
        .flatMap(i => r.byExercise.get(i.exerciseId)?.primaryMuscles ?? [])
        .map(m => groupMap[m])
        .filter(Boolean),
    );
    return [...trained].filter(
      group =>
        template.items
          .filter(
            i =>
              i.prescription?.block === 'cooldown' && r.byExercise.get(i.exerciseId)?.stretch_targets?.includes(group),
          )
          .reduce((sum, i) => sum + ('durationSeconds' in i.target ? i.sets * i.target.durationSeconds : 0), 0) <
        source.total_s_per_muscle_target,
    );
  });
  expect(shortfalls.length).toBeGreaterThan(0);
  expect(plan.quality!.issues.some(i => i.code === 'cooldown_stretch_target')).toBe(false);
  expect(plan.notices.length).toBeLessThanOrEqual(3);
  for (const notice of plan.notices)
    expect(
      Object.values(r.data.copy).some(
        copy => copy.sourceRuleId === notice.ruleId && copy.zh === notice.message.zh && copy.en === notice.message.en,
      ),
    ).toBe(true);
  const notice = plan.notices.find(n => n.code === 'session.copy.short_stretch_target');
  if (notice) expect(notice.message).toEqual(r.text('session.copy.short_stretch_target'));
});
