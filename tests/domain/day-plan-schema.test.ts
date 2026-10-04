import { expect, it } from 'vitest';
import { datePlanVersionSchema, planVersionSchema } from '../../src/domain/schemas';
const id = '00000000-0000-4000-8000-000000000001';
const dateVersion = { id, planId: id, revision: 0, versionNumber: 1, createdAt: '2026-10-04T00:00:00Z', updatedAt: '2026-10-04T00:00:00Z',
  model: 'date-day', startDate: '2027-02-28', scheduleTimeZone: 'Asia/Shanghai', goalSnapshot: { goal: '' },
  days: [{ dayId: id, date: '2027-02-28', exercises: [{ exerciseId: 'd16325d9-fc00-4c41-88a1-000000000003', order: 0, targetSets: [{ metricType: 'reps', reps: 10 }] }] }] };
it('accepts one explicit date without fabricated week fields', () => {
  expect(datePlanVersionSchema.parse(dateVersion)).toEqual(dateVersion);
  expect(planVersionSchema.parse(dateVersion)).toEqual(dateVersion);
});
it('rejects multiple days and week fields in a day version', () => {
  expect(() => datePlanVersionSchema.parse({ ...dateVersion, days: [...dateVersion.days, ...dateVersion.days] })).toThrow();
  expect(() => datePlanVersionSchema.parse({ ...dateVersion, durationWeeks: 1 })).toThrow();
});
it('requires an actual calendar date matching version origin', () => {
  expect(() => datePlanVersionSchema.parse({ ...dateVersion, startDate: '2027-02-30' })).toThrow();
  expect(() => datePlanVersionSchema.parse({ ...dateVersion, days: [{ ...dateVersion.days[0], date: '2027-03-01' }] })).toThrow();
});
