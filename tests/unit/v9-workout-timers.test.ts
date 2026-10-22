import { describe, expect, it } from 'vitest';
import {
  holdIdle,
  holdStart,
  holdPause,
  holdRemaining,
  holdStatus,
  holdSecondsToRecord,
  recommendedRestSeconds,
  restRemaining,
  restDone,
  restExtend,
  restVisible,
  restTotal,
  type RestPlan,
} from '../../src/ui/pages/training/timer-logic';

describe('V9 timed-exercise countdown', () => {
  it('waits for a tap, counts down and ends at zero', () => {
    const idle = holdIdle(30);
    expect(holdStatus(idle, 0)).toBe('idle');
    expect(holdRemaining(idle, 999_999)).toBe(30);
    const running = holdStart(idle, 1_000);
    expect(holdStatus(running, 1_000)).toBe('running');
    expect(holdRemaining(running, 1_000)).toBe(30);
    expect(holdRemaining(running, 1_400)).toBe(30);
    expect(holdRemaining(running, 2_000)).toBe(29);
    expect(holdRemaining(running, 31_000)).toBe(0);
    expect(holdStatus(running, 31_000)).toBe('done');
    expect(holdRemaining(running, 90_000)).toBe(0);
  });
  it('pauses and resumes without losing or gaining time', () => {
    let timer = holdStart(holdIdle(20), 0);
    timer = holdPause(timer, 5_000);
    expect(holdStatus(timer, 60_000)).toBe('paused');
    expect(holdRemaining(timer, 60_000)).toBe(15);
    timer = holdStart(timer, 60_000);
    expect(holdRemaining(timer, 70_000)).toBe(5);
    expect(holdStart(timer, 70_000)).toBe(timer);
  });
  it('restarts from the full target after it ended', () => {
    const ended = holdStart(holdIdle(10), 0);
    const again = holdStart(ended, 20_000);
    expect(holdRemaining(again, 20_000)).toBe(10);
  });
  it('records the target when untouched or finished and the real hold when stopped early', () => {
    expect(holdSecondsToRecord(holdIdle(40), 0)).toBe(40);
    const running = holdStart(holdIdle(40), 0);
    expect(holdSecondsToRecord(running, 12_600)).toBe(12);
    expect(holdSecondsToRecord(running, 300)).toBe(1);
    expect(holdSecondsToRecord(running, 41_000)).toBe(40);
    expect(holdSecondsToRecord(holdPause(running, 7_000), 99_000)).toBe(7);
  });
});

describe('V9 rest countdown', () => {
  const plan: RestPlan = { completedAt: 10_000, baseSeconds: 60, extraSeconds: 0 };
  it('uses the prescription rest within safe bounds, else 60 seconds', () => {
    expect(recommendedRestSeconds(75)).toBe(75);
    expect(recommendedRestSeconds(undefined)).toBe(60);
    expect(recommendedRestSeconds(Number.NaN)).toBe(60);
    expect(recommendedRestSeconds(5)).toBe(15);
    expect(recommendedRestSeconds(900)).toBe(300);
  });
  it('counts down from the moment the set was saved', () => {
    expect(restRemaining(plan, 10_000)).toBe(60);
    expect(restRemaining(plan, 40_000)).toBe(30);
    expect(restDone(plan, 69_999)).toBe(false);
    expect(restDone(plan, 70_000)).toBe(true);
  });
  it('adds 15 seconds, also after the countdown ended', () => {
    const longer = restExtend(plan, 20_000);
    expect(restTotal(longer)).toBe(75);
    expect(restRemaining(longer, 20_000)).toBe(65);
    const late = restExtend(plan, 100_000);
    expect(restRemaining(late, 100_000)).toBe(15);
  });
  it('never starts the next set: it only decides whether the rest screen is shown', () => {
    expect(restVisible(plan, 20_000, false)).toBe(true);
    expect(restVisible(plan, 20_000, true)).toBe(false);
    expect(restVisible(plan, 70_000 + 9 * 60_000, false)).toBe(true);
    expect(restVisible(plan, 70_000 + 11 * 60_000, false)).toBe(false);
    expect(restVisible(undefined, 0, false)).toBe(false);
  });
});

describe('only one hold countdown runs', () => {
  it('pauses every running timer except the one kept', async () => {
    const { holdStart, holdIdle, holdStatus, pauseOtherHolds } =
      await import('../../src/ui/pages/training/timer-logic');
    const a = holdStart(holdIdle(30), 0),
      b = holdStart(holdIdle(40), 0);
    const next = pauseOtherHolds({ a, b }, 5000, 'b');
    expect(holdStatus(next.a, 6000)).toBe('paused');
    expect(holdStatus(next.b, 6000)).toBe('running');
    expect(holdStatus(pauseOtherHolds({ a, b }, 5000).b, 6000)).toBe('paused');
  });
});
