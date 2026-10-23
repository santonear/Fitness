import { describe, expect, it } from 'vitest';
import { answerText, presetIn, storedSummaryText } from '../../src/application/preset-text';
import { presetSessionName, sessionNames } from '../../src/application/plan-presentation';
import { templateLabel, versionSummary } from '../../src/i18n/features/plan/labels';
import type { PlanVersion } from '../../src/domain/v8/contracts';

describe('stored preset answers follow the current language', () => {
  it('maps tapped goal and place options both ways', () => {
    expect(answerText('想瘦下来，身体轻一点', 'en')).toBe('I’d like to lose weight and feel lighter');
    expect(answerText('I’d like more strength and energy', 'zh')).toBe('想有些力量，不再容易累');
    expect(answerText('去健身房', 'en')).toBe('At the gym');
    expect(answerText('在家，没有器械', 'en')).toBe('At home, no equipment');
    expect(presetIn('每周 3 次，每次 30–45 分钟', 'en')).toBe('Three times a week, 30–45 minutes each time');
  });
  it('keeps the user’s own words exactly as typed', () => {
    expect(answerText('我想试试', 'en')).toBe('我想试试');
    expect(answerText('  想瘦下来，身体轻一点，还想跑马拉松', 'en')).toBe('  想瘦下来，身体轻一点，还想跑马拉松');
    expect(presetIn('', 'en')).toBeUndefined();
  });
  it('shows fixed app-written plan summaries in the current language', () => {
    expect(storedSummaryText('部分时长按动作估算', 'en')).toBe('Some durations are estimated from the exercises');
    expect(versionSummary({ changeSummary: ['部分时长按动作估算', '我自己的备注'] } as PlanVersion, 'en')).toEqual([
      'Some durations are estimated from the exercises',
      '我自己的备注',
    ]);
  });
  it('re-renders stored start-date and budget summaries in the current language', () => {
    const version = { startDate: '2026-10-24', changeSummary: ['开始日期改为 10月24日 周六'] } as PlanVersion;
    expect(versionSummary(version, 'en')[0]).toMatch(/^Start date changed to Oct 24/);
    expect(
      versionSummary({ ...version, changeSummary: ['Start date changed to Oct 24 Sat'] } as PlanVersion, 'zh')[0],
    ).toMatch(/^开始日期改为 10月24日/);
    expect(storedSummaryText('Switched to a weekly budget', 'zh')).toBe('改为每周预算');
    expect(storedSummaryText('改为按天安排', 'en')).toBe('Switched to day-by-day');
    expect(versionSummary({ changeSummary: ['开始日期改为 某天'] } as PlanVersion, 'en')).toEqual([
      '开始日期改为 某天',
    ]);
  });
});

describe('session names written by the app follow the current language', () => {
  const items = [{ exerciseId: 'squat', sets: 2, target: { type: 'reps', value: 10 } }] as never;
  it('translates kind names with their letter and keeps user names', () => {
    expect(presetSessionName('全身 A', 'en')).toBe('Full body A');
    expect(presetSessionName('Lower body', 'zh')).toBe('下肢');
    expect(presetSessionName('全身训练日', 'en')).toBeUndefined();
    expect(sessionNames([{ id: 'a', name: '下肢', items }], 'en').get('a')).toBe('Lower body');
    expect(sessionNames([{ id: 'a', name: '我的腿日', items }], 'en').get('a')).toBe('我的腿日');
  });
  it('replaces placeholder names in the workout header', () => {
    expect(templateLabel({ id: 'a', name: '训练' }, 'en')).toBe('Training');
    expect(templateLabel({ id: 'a', name: 'Training' }, 'zh')).toBe('训练');
    expect(templateLabel({ id: 'a', name: '全身 B' }, 'en')).toBe('Full body B');
    const plan = [
      { id: 'a', name: '训练', items },
      { id: 'b', name: '训练', items },
    ];
    expect(templateLabel(plan[1], 'en', plan)).toBe(sessionNames(plan, 'en').get('b'));
    expect(templateLabel({ id: 'a', name: '15 分钟' }, 'en')).toBe('15 min');
  });
});
