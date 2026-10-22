import { expect, it } from 'vitest';
import { generatePlan } from '../../src/engine';
import { Rules } from '../../src/engine/data';
import { baseProfile } from '../../tools/eval/training-engine-profiles';
import { mobilityBudgetExceedances } from '../../tools/eval/training-engine-mobility-budget';

it('independently detects excess mobility even when displayed minutes claim a large budget', () => {
  const rules = new Rules(),
    plan = generatePlan(baseProfile({ sessionMinutes: 30 }));
  expect(mobilityBudgetExceedances(plan, rules)).toEqual([]);
  const template = plan.templates.find(t =>
    t.items.some(i => rules.byExercise.get(i.exerciseId)?.modality === 'mobility'),
  )!;
  const item = structuredClone(template.items.find(i => rules.byExercise.get(i.exerciseId)?.modality === 'mobility')!);
  item.sets = 1;
  item.target = { metricType: 'duration', durationSeconds: 1000 };
  template.items = [item];
  template.estimatedMinutes = 120;
  expect(mobilityBudgetExceedances(plan, rules)).toEqual([
    expect.objectContaining({
      templateId: template.id,
      seconds: expect.any(Number),
      limitSeconds: expect.any(Number),
    }),
  ]);
});
