import { expect, it } from 'vitest';
import { chineseName } from '../../tools/catalog/names-zh.mjs';
it.each([
  ['leg-swing-front-to-back', '前后摆腿'],
  ['knee-to-chest-stretch', '仰卧抱膝拉伸'],
  ['bench-figure-4-glute-stretch', '凳上坐姿四字臀部拉伸'],
  ['bench-adductor-stretch', '站姿凳上内收肌拉伸'],
])('names %s by its reviewed source motion and posture', (slug, name) => {
  expect(chineseName(slug)).toBe(name);
});
it('keeps unrelated bench and source special-case names unchanged', () => {
  expect(chineseName('bench-press')).toBe('卧推');
  expect(chineseName('squat')).toBe('杠铃背蹲');
  expect(chineseName('banded-standing-curl')).toBe('弹力带站姿腿弯举');
});
