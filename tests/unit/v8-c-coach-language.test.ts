import { describe, expect, it } from 'vitest';
import { checkCoachLanguage, checkSafetyLanguage } from '../../src/application/rules/coach-language';

describe('coach wording, UIUX20261008 part 2 section 7.2', () => {
  it.each(['失败', '没坚持住', '偷懒', '你应该', '你必须', '只完成了 1/3', '本周只完成 1／3', '太棒了！！！', '你是最棒的', '减肥失败的原因是'])('rejects the banned example %s', text => {
    expect(checkCoachLanguage(text).length).toBeGreaterThan(0);
  });
  it.each(['加油!', '加油！', '完成了😀', '完成了🇨🇳', '完成了1️⃣', '完成了 🎯📈'])('rejects exclamations and emoji outside the v5 rule: %s', text => {
    expect(checkCoachLanguage(text).length).toBeGreaterThan(0);
  });
  it.each(['我算了一下，15 分钟刚好把后背这 4 组补上 🎯', '你回来啦 🌱', '这段路走得扎实 🏔️', '深蹲比一个月前多了 7.5kg，你是真的变强了 💪'])('accepts one listed emoji (wording v5): %s', text => {
    expect(checkCoachLanguage(text)).toEqual([]);
  });
  it('rejects any emoji in safety, pain, medical and low-mood lines', () => {
    expect(checkSafetyLanguage('先歇着，找专业的人看看 🌱')).toEqual(['emoji']);
    expect(checkSafetyLanguage('先歇着，找专业的人看看。')).toEqual([]);
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
