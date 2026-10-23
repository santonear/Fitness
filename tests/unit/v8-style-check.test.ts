import { describe, expect, it } from 'vitest';
// @ts-expect-error plain ESM tool without type declarations
import { violations } from '../../tools/v8/check.mjs';

describe('style check: literal radius, shadow and font size (AGENTS.md §2.1)', () => {
  it.each([
    '.a { border-radius: 3px; }',
    '.a { border-top-left-radius: 1rem; }',
    '.a { font-size: 0.38em; }',
    '.a { box-shadow:\n    var(--el-inset),\n    0 0 0 2px var(--c-focus); }',
  ])('flags %s', css => {
    expect(violations('src/ui/pages/x.css', css)).toContain('literal-size');
  });
  it.each([
    '.a { border-radius: var(--r-chip); }',
    '.a { border-radius: 50%; font-size: inherit; box-shadow: none; }',
    '.a { border-radius: 0; }',
    '.a { box-shadow: 0 0 calc(var(--s1) * 1.5) var(--glow); }',
  ])('allows %s', css => {
    expect(violations('src/ui/components/x.css', css)).not.toContain('literal-size');
  });
  it('leaves theme token files alone', () => {
    expect(violations('src/themes/pop/tokens.css', '.a { border-radius: 3px; }')).not.toContain('literal-size');
  });
});
