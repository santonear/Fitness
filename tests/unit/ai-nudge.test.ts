import { describe, expect, it } from 'vitest';
import { dismissNudges, markNudge, missedTwoWeeks, noteSwap, pickNudge } from '../../src/ui/mainline/ai-nudge';
import type { WorkoutRecord } from '../../src/domain/v8/contracts';

const w = (localDate: string) => ({ localDate, status: 'complete' }) as WorkoutRecord;
const base = { today: '2026-10-28', paused: false, weeklyTarget: 3, planStart: '2026-09-01' };

describe('AI nudges', () => {
  it('offers the first weekly review once, after a week with training', () => {
    expect(pickNudge({ ...base, route: 'review', workouts: [w('2026-10-27')] }, {})).toBeUndefined();
    expect(pickNudge({ ...base, route: 'review', workouts: [w('2026-10-21')] }, {})).toBe('firstReview');
    const shown = markNudge({}, 'firstReview', '2026-10-28');
    expect(
      pickNudge({ ...base, route: 'review', workouts: [w('2026-10-21')], today: '2026-11-04' }, shown),
    ).toBeUndefined();
  });
  it('offers a change after two short weeks or two swaps, at most one nudge a week', () => {
    const short = [w('2026-10-13'), w('2026-10-20')];
    expect(missedTwoWeeks(short, 3, '2026-09-01', '2026-10-28')).toBe(true);
    expect(missedTwoWeeks(short, 3, '2026-10-20', '2026-10-28')).toBe(false);
    expect(pickNudge({ ...base, route: 'plan-home', workouts: short }, {})).toBe('notFit');
    const swapped = noteSwap(noteSwap({}, '2026-10-28'), '2026-10-28');
    expect(pickNudge({ ...base, route: 'plan-home', workouts: [] }, swapped)).toBe('notFit');
    const reviewWeek = markNudge({}, 'firstReview', '2026-10-28');
    expect(pickNudge({ ...base, route: 'plan-home', workouts: short }, reviewWeek)).toBeUndefined();
  });
  it('stays quiet for 30 days after 不用了 and while training is paused', () => {
    const quiet = dismissNudges({}, '2026-10-28');
    expect(pickNudge({ ...base, route: 'review', workouts: [w('2026-10-21')] }, quiet)).toBeUndefined();
    expect(pickNudge({ ...base, route: 'review', workouts: [w('2026-10-21')], today: '2026-11-28' }, quiet)).toBe(
      'firstReview',
    );
    expect(pickNudge({ ...base, route: 'review', workouts: [w('2026-10-21')], paused: true }, {})).toBeUndefined();
  });
});
