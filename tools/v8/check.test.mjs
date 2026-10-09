import { test } from 'node:test';
import assert from 'node:assert/strict';
import { violations } from './check.mjs';

test('rejects new literal colors and fonts in pages', () => {
  assert.deepEqual(violations('src/ui/pages/Next.tsx', 'color:#ffffff; font-family:serif'), ['literal-color', 'font-family']);
});
test('theme selectors are restricted to theme tokens', () => {
  assert.deepEqual(violations('src/ui/base.css', '[data-theme=x] {}'), ['theme-selector']);
  assert.deepEqual(violations('src/themes/qingci/tokens.css', '[data-theme=x] {}'), []);
});
test('rejects developer entry and coach banned text', () => {
  assert.deepEqual(violations('src/admin/Panel.tsx', 'AI 架构评审'), ['developer-entry']);
  assert.deepEqual(violations('src/i18n/features/coach/zh.json', '你必须'), ['coach-language']);
});
