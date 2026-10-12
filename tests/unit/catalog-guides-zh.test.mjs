import {readFile} from 'node:fs/promises';
import {describe,it,expect} from 'vitest';
import {chineseGuides} from '../../tools/catalog/guides-zh.mjs';

const registry=JSON.parse(await readFile('src/catalog/generated/registry.json','utf8'));
const generated=JSON.parse(await readFile('src/catalog/generated/guides-zh.json','utf8'));
const core=JSON.parse(await readFile('src/catalog/generated/core.json','utf8'));

describe('Chinese exercise guide generation',()=>{
 it('generates exactly the reviewed source and covers 100 additional catalog actions',()=>{
  expect(generated).toEqual(chineseGuides);
  expect(Object.keys(chineseGuides).length).toBeGreaterThanOrEqual(271);
  expect(Object.keys(chineseGuides).every(slug=>registry.some(entry=>entry.slug===slug))).toBe(true);
 });
 it('provides action-specific setup and usable guidance',()=>{
  for(const [slug,guide] of Object.entries(chineseGuides)){
   expect(guide.keyPoints.length,slug).toBeGreaterThanOrEqual(2);
   expect(guide.steps.length,slug).toBeGreaterThanOrEqual(2);
   expect(guide.mistakes.length,slug).toBeGreaterThanOrEqual(1);
   expect(guide.cautions.length,slug).toBeGreaterThanOrEqual(1);
   expect(guide.steps.join(''),slug).not.toContain('对照动作图确认姿势');
  }
  expect(chineseGuides['kettlebell-swing'].steps.join('')).toContain('髋');
  expect(chineseGuides['cable-pallof-press'].steps.join('')).toContain('旋转');
  expect(chineseGuides['box-jump'].cautions.join('')).toContain('跳跃');
 });
 it('keeps the pending list in sync with the catalog',async()=>{
  const report=await readFile('tools/catalog/pending-guides-zh.txt','utf8');
  const pending=registry.filter(entry=>!chineseGuides[entry.slug]);
  expect(report).toContain(`待补 ${pending.length}`);
  for(const entry of pending)expect(report).toContain(`${entry.slug}\t${entry.bodyPart}`);
 });
 it('syncs the runtime core Chinese steps and cautions with the guide source',()=>{
  const slugById=new Map(registry.map(entry=>[entry.id,entry.slug]));
  for(const entry of core){const guide=chineseGuides[slugById.get(entry.id)];if(!guide)continue;
   expect(entry.steps.zh,entry.id).toEqual(guide.steps);
   expect(entry.cautions.zh,entry.id).toEqual(guide.cautions);
  }
 });
});
