import { describe, expect, it } from 'vitest';
import { evaluateSlot, validateLegacyConfirmation } from '../../src/domain/day-slot-policy';
import { task, slot } from './fixtures/day-slot-fixtures';

describe('day slot contract (no persistence or timezone inference)', () => {
  it('retains separate hidden/skipped history while allowing a new task', () => {
    const input = [task({ hidden: true }), task({ taskId: 'skip', status: 'skipped' })];
    const before = structuredClone(input);
    expect(evaluateSlot(input, slot)).toEqual({ occupants: [], releasedHistory: ['legacy-a', 'skip'] });
    expect(evaluateSlot([...input, task({ taskId: 'new', source: 'date-day' })], slot).occupants).toEqual(['new']);
    expect(input).toEqual(before);
  });
  it('completed identity wins over hidden; temporary facts are not slot tasks', () => {
    expect(evaluateSlot([task({ hidden: true, completedSessionId: 'session-a' })], slot).occupants).toEqual(['legacy-a']);
  });
  it('in-progress protection wins over hidden and archived flags', () => {
    expect(evaluateSlot([task({ hidden: true, current: false, inProgressSessionId: 'ongoing' })], slot).occupants).toEqual(['legacy-a']);
  });
  it('rescheduled task occupies its projected scheduled date only', () => {
    expect(evaluateSlot([task({ projectedDate: '2027-01-05' })], slot).occupants).toEqual([]);
    expect(evaluateSlot([task({ projectedDate: '2027-01-05' })], '2027-01-05').occupants).toEqual(['legacy-a']);
  });
  it('noncurrent history does not occupy unless it has a protected association', () => {
    expect(evaluateSlot([task({ current: false })], slot).occupants).toEqual([]);
    expect(evaluateSlot([task({ current: false, completedSessionId: 'done' })], slot).occupants).toEqual(['legacy-a']);
  });
  it('preserves legacy collisions, deterministic order, and does not merge tasks by date', () => {
    const tasks = [task({ taskId: 'z' }), task({ taskId: 'a' }), task({ taskId: 'skip', status: 'skipped' })];
    expect(evaluateSlot(tasks, slot)).toEqual({ occupants: ['a', 'z'], releasedHistory: ['skip'] });
    expect(evaluateSlot([...tasks].reverse(), slot)).toEqual(evaluateSlot(tasks, slot));
  });
  it('rejects duplicate task identities rather than inventing history', () => {
    expect(() => evaluateSlot([task(), task()], slot)).toThrow('Duplicate taskId');
  });
  it('rejects impossible dates and unapproved cancelled state', () => {
    expect(() => evaluateSlot([task()], '2027-02-30')).toThrow();
    expect(() => evaluateSlot([task({ status: 'cancelled' as 'pending' })], slot)).toThrow();
  });
});

describe('legacy collision confirmation dependency guard', () => {
  const before = { restoreGeneration: 2, tasks: [task(), task({ taskId: 'new', source: 'date-day' })] };
  it('accepts order changes and an unrelated write represented by identical dependencies', () => {
    expect(validateLegacyConfirmation(before, { ...before, tasks: [...before.tasks].reverse() })).toBe(true);
  });
  it('invalidates every old confirmation after restore', () => {
    expect(validateLegacyConfirmation(before, { ...before, restoreGeneration: 3 })).toBe(false);
  });
  it('invalidates revisions, occupant additions/removals and state/date changes', () => {
    for (const tasks of [before.tasks.slice(1), [...before.tasks, task({ taskId: 'third' })],
      [task({ revision: 2 }), before.tasks[1]], [task({ hidden: true }), before.tasks[1]],
      [task({ projectedDate: '2027-01-05' }), before.tasks[1]]]) {
      expect(validateLegacyConfirmation(before, { ...before, tasks })).toBe(false);
    }
  });
  it('rejects malformed counters without authorizing an operation', () => {
    expect(() => validateLegacyConfirmation(before, { ...before, restoreGeneration: -1 })).toThrow();
  });
});
