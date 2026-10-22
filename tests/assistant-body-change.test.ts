import { describe, expect, it } from 'vitest';
import { detectBodyChange } from '../src/assistant/body-change';

describe('local body-change referral', () => {
  it.each([
    ['我怀孕了', 'pregnancy'],
    ['我有了宝宝', 'pregnancy'],
    ['现在孕20周', 'pregnancy'],
    ['备孕成功', 'pregnancy'],
    ['I am pregnant', 'pregnancy'],
    ['我上个月刚生完', 'postpartum'],
    ['我剖宫产了', 'postpartum'],
    ['I gave birth last month', 'postpartum'],
    ['I had a C-section', 'postpartum'],
    ['我做了手术', 'health'],
    ['医生让我别运动', 'health'],
    ['I had surgery', 'health'],
  ])('recognizes %s locally', (message, kind) => {
    expect(detectBodyChange(message)).toBe(kind);
  });
  it.each([
    '刚生成的计划很好',
    '发生了什么问题',
    '产生了一个新版本',
    '刚生效的设置',
    '我刚生气了',
    '医生完成了手术',
    '什么是剖宫产',
    'How does a C-section work?',
    '我老婆怀孕了',
    '朋友刚生完',
    '没怀孕',
    '我没有怀孕',
    '如果怀孕了怎么办',
    '假如产后能练吗',
    'My wife is pregnant',
    'My friend gave birth',
    'I am not pregnant',
    'If I am pregnant',
    'She is postpartum',
    'Suppose I had surgery',
    'I am not currently pregnant',
    'I have never had surgery',
    'My mother is pregnant',
    'My colleague gave birth',
    'Could I be pregnant?',
    'I was pregnant last year',
    '我并没有怀孕',
    '我并非处于产后',
    '同学刚生完',
    '我曾经怀孕过',
  ])('does not infer a personal change from %s', message => {
    expect(detectBodyChange(message)).toBeUndefined();
  });
  it('does not refer an unchanged population', () => {
    expect(detectBodyChange('我怀孕了', 'pregnancy')).toBeUndefined();
    expect(detectBodyChange('I am postpartum', 'postpartum')).toBeUndefined();
    expect(detectBodyChange('I am pregnant', 'pregnant')).toBeUndefined();
    expect(detectBodyChange('I gave birth', 'pregnancy')).toBe('postpartum');
  });
});
