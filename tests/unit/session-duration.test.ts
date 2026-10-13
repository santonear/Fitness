import { describe, expect, it } from 'vitest';
import { sessionDuration } from '../../src/application/rules/session-duration';

describe('explicit session duration', () => {
  it.each([['1小时',60],['一个小时',60],['半小时',30],['一个半小时',90],['1.5小时',90],['每周4次，每次15分钟，可以延长到1小时',60],['15分钟到1小时',60],['30–45分钟',30],['40 minutes',40],['up to 1 hour',60]] as const)('%s → %i', (text, minutes) => {
    expect(sessionDuration(text)).toBe(minutes);
  });
  it('does not fabricate a length from a frequency', () => expect(sessionDuration('每周4次')).toBeUndefined());
});
