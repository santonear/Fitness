import { describe, expect, it } from 'vitest';
import { lastWeekSummary } from '../../src/application/last-week';

// 2026-10-23 is a Friday; this week starts 2026-10-19, last week is 10-12 to 10-18.
const facts = {
  from: '2026-10-12',
  to: '2026-10-18',
  complete: 2,
  partial: 1,
  improvements: [
    { exerciseId: 'plank', metric: 'durationSeconds' as const, previous: 30, current: 45 },
    { exerciseId: 'bench', metric: 'loadGrams' as const, previous: 40000, current: 42500 },
  ],
};
const input = {
  today: '2026-10-23',
  facts,
  weeklyTarget: 3,
  planFirstStart: '2026-10-01',
  currentStart: '2026-10-01',
  hasRecord: true,
  active: false,
};

describe('上周一张图', () => {
  it('counts partial sessions as done and prefers a load improvement', () => {
    expect(lastWeekSummary(input)).toEqual({
      week: '2026-10-19',
      done: 3,
      target: 3,
      improvement: { exerciseId: 'bench', metric: 'loadGrams', gain: 2500 },
    });
  });
  it('shows a zero week without an improvement line', () => {
    expect(lastWeekSummary({ ...input, facts: { ...facts, complete: 0, partial: 0, improvements: [] } })).toEqual({
      week: '2026-10-19',
      done: 0,
      target: 3,
    });
  });
  it('stays hidden without a plan last week, without records, during a workout or before the start date', () => {
    expect(lastWeekSummary({ ...input, planFirstStart: '2026-10-19' })).toBeUndefined();
    expect(lastWeekSummary({ ...input, planFirstStart: undefined })).toBeUndefined();
    expect(lastWeekSummary({ ...input, hasRecord: false })).toBeUndefined();
    expect(lastWeekSummary({ ...input, active: true })).toBeUndefined();
    expect(lastWeekSummary({ ...input, currentStart: '2026-10-25' })).toBeUndefined();
    expect(lastWeekSummary({ ...input, facts: { ...facts, from: '2026-10-05', to: '2026-10-11' } })).toBeUndefined();
  });
});
