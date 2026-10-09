import { describe, expect, it } from 'vitest';
import { mapSchedule } from '../../src/application/rules/map-schedule';

// UIUX20261008, part 3 B: preserve the answer, map only legal onboarding minutes.
describe('V8 schedule compatibility mapping', () => {
  it.each([30, 40, 50, 60, 70, 80, 90, 100, 110, 120])('accepts %i minutes exactly', value => {
    expect(mapSchedule(`每次 ${value} 分钟`).minutes).toEqual({ status: 'answered', value });
  });
  it.each(['30–45分钟', '25到45分钟', '30 minutes to 45 minutes', '0.5–1 hour'])('takes the smallest legal value in %s', text => {
    expect(mapSchedule(text).minutes).toEqual({ status: 'answered', value: 30 });
  });
  it.each(['15分钟', '20分钟', '29分钟', '35分钟', '125分钟', '你帮我定', '你帮我定，30分钟也行', 'help me decide', '晚上7点', '30或60分钟', '60-30分钟', '15-20分钟', '30分钟或40分钟', '-30分钟', ''])('skips rather than guesses: %s', text => {
    expect(mapSchedule(text).minutes).toEqual({ status: 'skipped' });
  });
  it('preserves original short-plan durations and never infers a start time', () => {
    const originalText = '  晚上7点，20分钟  ';
    expect(mapSchedule(originalText)).toEqual({ originalText, minutes: { status: 'skipped' }, startTime: { status: 'skipped' } });
  });
  it('does not use weekly frequency as session duration', () => {
    expect(mapSchedule('每周3次，每次40分钟，晚上8点').minutes).toEqual({ status: 'answered', value: 40 });
  });
});
