import { describe, it, expect } from 'vitest';
import { localProfile, preferredTrainingDays, weeklyFrequency } from '../../src/application/rules/local-profile';
import { basicProposal } from '../../src/application/v8-workflow';
import { exercises } from '../../src/catalog/exercises';
import type { CoachRequest } from '../../src/coach/contracts';
import { localCoachReply } from '../../src/coach/local-fallback';
const answers = {
  goalText: '减脂',
  scheduleOriginalText: '工作日两次、周末一次，每次40分钟左右',
  placeEquipmentText: '在家，只有瑜伽垫',
  adultConfirmed: true,
  cautions: [],
};
const phrases: [string, number, number][] = [
  ['工作日两次、周末一次，每次40分钟左右', 3, 40],
  ['工作日三次、周末一次，每次30分钟', 4, 30],
  ['平日一次，周末两次，每次50分钟', 3, 50],
  ['每周一次，每次30分钟', 1, 30],
  ['每周两次，每次40分钟', 2, 40],
  ['每周三次，每次50分钟', 3, 50],
  ['每周四次，每次60分钟', 4, 60],
  ['每周五次，每次30分钟', 5, 30],
  ['每周六次，每次30分钟', 6, 30],
  ['每周七次，每次30分钟', 7, 30],
  ['一周3次，每次40分钟左右', 3, 40],
  ['每周 4 次，每次 30–45 分钟', 4, 30],
  ['每周2次，每次20分钟', 2, 20],
  ['每周3次，每次15分钟', 3, 15],
  ['每次40分钟左右', 2, 40],
  ['每周3次，每次1小时', 3, 60],
  ['Once a week, 30 minutes', 1, 30],
  ['Twice a week, 40 minutes', 2, 40],
  ['Three times a week, 50 minutes', 3, 50],
  ['Four times a week, 60 minutes', 4, 60],
  ['Five times a week, 30 minutes', 5, 30],
  ['Six times a week, 30 minutes', 6, 30],
  ['Seven times a week, 30 minutes', 7, 30],
  ['3 times per week, 40 mins', 3, 40],
  ['weekly 4, 30 minutes', 4, 30],
  ['weekdays twice, weekends once, 40 minutes', 3, 40],
  ['weekdays three times, weekends once, 30 minutes', 4, 30],
  ['two times weekly, 20 minutes', 2, 20],
  ['3 times a week, 30–45 minutes', 3, 30],
  ['twice a week, 1 hour', 2, 60],
  ['three times per week, 15 mins', 3, 15],
  ['about 40 minutes each time', 2, 40],
];
describe('V2 local plan quality', () => {
  it.each(['一三五晚上可以，每次40分钟左右，周末偶尔能练一次', '周一三五晚上可以，周末偶尔一次', '一三五晚上可以'])(
    'keeps the three named days as weekly sessions: %s',
    text => {
      expect(weeklyFrequency(text)).toBe(3);
      expect(preferredTrainingDays(text)).toEqual(['mon', 'wed', 'fri']);
      expect(localProfile({ ...answers, scheduleOriginalText: text }).preferredDays).toEqual(['mon', 'wed', 'fri']);
    },
  );
  it.each(['一周三次', '每周三练', '每周三次'])('parses explicit three sessions: %s', text =>
    expect(weeklyFrequency(text)).toBe(3),
  );
  it.each(phrases)('parses %s', (text, weekly, minutes) => {
    const result = localProfile({ ...answers, scheduleOriginalText: text });
    expect(result.weeklyTarget).toBe(weekly);
    expect(result.sessionMinutes).toBe(minutes);
    expect(result.scheduleOriginalText).toBe(text);
  });
  it('adds available low impact cardio for fat loss and limits all sets', () => {
    const plan = basicProposal(localProfile(answers))!;
    expect(plan.templates).toHaveLength(2);
    expect(plan.templates[0].items[0].exerciseId).not.toBe(plan.templates[1].items[0].exerciseId);
    for (const template of plan.templates) {
      expect(template.items.every(item => item.sets <= 4)).toBe(true);
      expect(template.items.some(item => exercises.find(e => e.id === item.exerciseId)?.name.en === 'Walking')).toBe(
        true,
      );
    }
  });
  it('keeps cautions and only confirmed equipment with low-impact cardio', () => {
    const plan = basicProposal(localProfile({ ...answers, cautions: ['knee'] }))!;
    expect(
      plan.templates
        .flatMap(t => t.items)
        .every(
          item =>
            item.equipment === 'none' &&
            !/squat|lunge|jump/i.test(exercises.find(e => e.id === item.exerciseId)?.name.en ?? ''),
        ),
    ).toBe(true);
    for (const template of plan.templates)
      expect(template.items.some(item => exercises.find(e => e.id === item.exerciseId)?.name.en === 'Walking')).toBe(
        true,
      );
  });
  it('explains a named exercise with a guide link', () => {
    const reply = localCoachReply('徒手深蹲怎么做');
    expect(reply.guideExerciseId).toBeTruthy();
    expect(reply.lines.join('')).toContain('屈髋屈膝');
  });
  it('gives a short actionable session without a saved plan', () => {
    expect(localCoachReply('只有15分钟', undefined, localProfile(answers)).lines.join('')).toContain('组');
  });
  it('offers a 15 minute candidate and compatible replacement without writing the input', () => {
    const profile = localProfile(answers),
      id = '11111111-1111-4111-8111-111111111111';
    const request: Extract<CoachRequest, { task: 'ADJUST_TODAY' }> = {
      version: 'fitness-coach-v8',
      requestId: id,
      conversationId: id,
      restoreGeneration: 0,
      inputSnapshot: 'local',
      sendConfirmation: 'local',
      locale: 'zh',
      timeZone: 'Asia/Shanghai',
      adultConfirmed: true,
      messages: [],
      task: 'ADJUST_TODAY',
      target: { planId: id, versionId: id, revision: 1 },
      template: basicProposal(profile)!.templates[0],
      instruction: '15分钟',
    };
    const before = structuredClone(request),
      short = localCoachReply('今天只有15分钟', request, profile);
    expect(short.response?.type).toBe('today_adjustment');
    if (short.response?.type === 'today_adjustment')
      expect(short.response.template.estimatedMinutes).toBeLessThanOrEqual(15);
    const swap = localCoachReply('替换徒手深蹲', request, profile);
    expect(swap.response?.type).toBe('today_adjustment');
    if (swap.response?.type === 'today_adjustment')
      expect(swap.response.template.items.every(item => item.equipment === 'none')).toBe(true);
    expect(localCoachReply('替换徒手深蹲', request, { ...profile, cautions: ['other'] }).response).toBeUndefined();
    expect(localCoachReply('替换徒手深蹲', { ...request, workoutId: id }, profile, 'zh', [0]).response).toBeUndefined();
    expect(request).toEqual(before);
  });
  it('keeps an English local capability entry instead of claiming a service failure', () => {
    const reply = localCoachReply('hello', undefined, undefined, 'en');
    expect(reply.lines.join(' ')).toContain('Enable AI');
    expect(reply.lines.join(' ')).toContain('exercise technique');
  });
  it.each([
    '在家，没有哑铃，没有弹力带',
    'At home, no dumbbells, no resistance bands',
    "At home, I don't have dumbbells or resistance bands",
  ])('does not invent denied equipment: %s', text => {
    const plan = basicProposal(localProfile({ ...answers, placeEquipmentText: text }))!;
    expect(plan.templates.flatMap(template => template.items).every(item => item.equipment === 'none')).toBe(true);
  });
});
