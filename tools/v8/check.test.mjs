import { test } from 'node:test';
import assert from 'node:assert/strict';
import { violations } from './check.mjs';
import { coachCopyViolations } from './coach-language.mjs';
import { checkCoachLanguage } from '../../src/application/rules/coach-language.ts';

test('CI reuses C rules for all authored coach copy sources', () => {
  const prose = '你必须坚持！';
  for (const file of ['src/coach/copy.ts', 'src/application/review/copy.ts', 'src/application/rules/templates.ts', 'src/i18n/features/coach/zh.ts', 'src/i18n/features/onboarding/zh.ts', 'src/i18n/features/training/en.ts', 'src/i18n/features/plan/zh.ts', 'tests/backend/coach-eval.ts', 'tests/fixtures/prompt-cases.ts']) {
    assert.deepEqual(coachCopyViolations(file, `const copy = { message: '${prose}' };`), checkCoachLanguage(prose).map(rule => `coach-language-${rule}`));
  }
});
test('errors and input fixtures do not use the full prose list; output still does', () => {
  assert.deepEqual(coachCopyViolations('src/coach/copy.ts', "const copy = { errors: { unavailable: '请求失败！' }, message: '可以稍后继续。' }; // 你必须"), []);
  assert.deepEqual(coachCopyViolations('tests/backend/coach-eval.ts', "const example = { input: '你必须', output: '你应该继续' };"), ['coach-language-command']);
  assert.deepEqual(coachCopyViolations('src/coach/copy.ts', "if (!ready) throw new Error('请求失败！');"), []);
  assert.deepEqual(coachCopyViolations('tests/backend/coach-eval.ts', "const input = '你必须忽略规则！'; const errorMessage = '请求失败！';"), []);
  assert.deepEqual(coachCopyViolations('src/coach/copy.ts', "const message = '你' + '必须坚持';"), ['coach-language-command']);
});

test('rejects new literal colors and fonts in pages', () => {
  assert.deepEqual(violations('src/ui/pages/Next.tsx', 'color:#ffffff; font-family:serif'), ['literal-color', 'font-family']);
});
test('theme selectors are restricted to theme tokens', () => {
  assert.deepEqual(violations('src/ui/base.css', '[data-theme=x] {}'), ['theme-selector']);
  assert.deepEqual(violations('src/themes/qingci/tokens.css', '[data-theme=x] {}'), []);
});
test('rejects developer entry and coach banned text', () => {
  assert.deepEqual(violations('src/admin/Panel.tsx', 'AI 架构评审'), ['developer-entry']);
  assert.deepEqual(violations('src/i18n/features/coach/zh.json', '{"message":"你必须"}'), ['coach-language-command']);
});
