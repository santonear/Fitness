import { readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import sources from '../../src/themes/fonts/sources.json';
import { themes } from '../../src/themes/registry';
const read = (file:string)=>readFileSync(new URL(`../../src/themes/fonts/${file}`,import.meta.url));
describe('bundled V8 fonts',()=>{
 it('keeps 3500 common characters and traceable licensed local WOFF2 assets',()=>{
  expect(new Set(read('common-3500.txt').toString().match(/[\u3400-\u9fff]/g)).size).toBe(3500);
  for(const [family,info] of Object.entries(sources.fonts)) {
   const bytes=read(`${family}.woff2`); expect(bytes.subarray(0,4).toString()).toBe('wOF2');
   expect(bytes.byteLength).toBe(info.bytes); expect(createHash('sha256').update(bytes).digest('hex')).toBe(info.sha256);
   expect(read(`${family}-OFL.txt`).toString()).toContain('SIL OPEN FONT LICENSE');
  }
 });
 it('declares local faces and only each theme required resources',()=>{
  const css=read('fonts.css').toString(); expect(css.match(/font-display: swap/g)).toHaveLength(5); expect(css).not.toMatch(/https?:/);
  expect(themes.map(theme=>theme.fonts.length)).toEqual([3,2,2,2]);
  for(const theme of themes) for(const path of theme.fonts) expect(path).toContain('.woff2');
 });
});
