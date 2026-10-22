import { expect, it } from 'vitest';
import { sessionTemplateSchema } from '../../src/coach/contracts';
import { v8PlanVersionSchema } from '../../src/domain/schemas';
import { Rules } from '../../src/engine/data';

const exercise = new Rules().data.exercises.find(row => row.slug === 'walking')!;
const template = {
  id: 'source-walk',
  name: 'Walking',
  estimatedMinutes: 2,
  estimatedSeconds: 120,
  durationScope: 'untargeted' as const,
  items: [
    {
      exerciseId: exercise.id,
      equipment: 'none',
      sets: 1,
      target: { metricType: 'duration' as const, durationSeconds: 120 },
    },
  ],
};

it('preserves actual elapsed minutes for the existing untargeted source-course type', () => {
  expect(sessionTemplateSchema.parse(template).estimatedMinutes).toBe(2);
  expect(v8PlanVersionSchema.shape.templates.element.parse(template).estimatedMinutes).toBe(2);
});
it.each([
  { ...template, durationScope: undefined },
  { ...template, targetMinutes: 10 },
  { ...template, estimatedMinutes: 0 },
  { ...template, estimatedMinutes: 121 },
])('retains ordinary-course and positive-duration limits', value => {
  expect(sessionTemplateSchema.safeParse(value).success).toBe(false);
  expect(v8PlanVersionSchema.shape.templates.element.safeParse(value).success).toBe(false);
});
