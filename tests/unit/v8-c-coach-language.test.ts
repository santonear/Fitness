import { describe, expect, it } from 'vitest';
import { checkCoachLanguage } from '../../src/application/rules/coach-language';

describe('coach wording, UIUX20261008 part 2 section 7.2', () => {
  it.each(['失败', '没坚持住', '偷懒', '你应该', '你必须', '只完成了 1/3', '本周只完成 1／3', '太棒了！！！', '你是最棒的', '减肥失败的原因是'])('rejects the banned example %s', text => {
    expect(checkCoachLanguage(text).length).toBeGreaterThan(0);
  });
  it.each(['加油!', '加油！', '完成了💪', '完成了🇨🇳', '完成了1️⃣'])('rejects exclamations or emoji: %s', text => {
    expect(checkCoachLanguage(text).length).toBeGreaterThan(0);
  });
  it.each([
    '这周你动了 5 次，比上周多 1 次。',
    '节奏在慢慢稳下来。',
    '完成了 1 次，还差 2 次。',
    '如果疼痛明显或持续，先休息，并请专业人士看看。',
    '饮食这部分芽芽看不到，所以不会只凭训练下结论。',
    '想看到身体的变化，每周记一次就够。',
    'Completed 1 session, with 2 remaining.',
  ])('accepts neutral factual wording: %s', text => {
    expect(checkCoachLanguage(text)).toEqual([]);
  });
  it('returns no source text and has deterministic repeated checks', () => {
    expect(checkCoachLanguage('你必须坚持，别偷懒！')).toEqual(['judgment', 'command', 'exclamation']);
    expect(checkCoachLanguage('你必须坚持，别偷懒！')).toEqual(['judgment', 'command', 'exclamation']);
  });
});
