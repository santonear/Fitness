import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sources from '../../src/themes/fonts/compact-sources.json';
import { getAvailableThemes, fullthemes } from '../../src/themes/registry';

describe('followup finish resources', () => {
 it('keeps the baseline four themes when discovery is disabled', () => {
  expect(getAvailableThemes(false).map(t => t.id)).toEqual(['qingci','liubai','jingshe','zhuangse']);
  expect(getAvailableThemes(true)).toBe(fullthemes);
 });
 it('preserves required glyph coverage with traceable compact assets and strict decimal budgets', () => {
  for (const [family, value] of Object.entries(sources)) {
   const bytes = readFileSync(`src/themes/fonts/${family}-compact.woff2`);
   expect(value.missingGlyphs).toEqual([]);
   expect(value.missingAppCjkGlyphs).toEqual([]);
   expect(bytes.length).toBe(value.bytes);
   expect(createHash('sha256').update(bytes).digest('hex')).toBe(value.sha256);
  }
  const size = (family:string) => readFileSync(`src/themes/fonts/${family}.woff2`).length;
  const sans=size('notosanssc-compact'), serif=size('notoserifsc-compact');
  for(const bytes of [sans+serif+size('cormorantgaramond'),sans+serif,sans+size('jost'),size('notosanssc')+size('archivo')]) expect(bytes).toBeLessThanOrEqual(1_500_000);
 });
});
