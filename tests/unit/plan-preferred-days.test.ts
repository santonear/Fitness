import {describe,expect,it} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {createElement} from 'react';
import {PlanPage,preferredDaysLabel} from '../../src/ui/pages/plan/PlanPage';
import type {PlanVersion} from '../../src/domain/v8/contracts';

describe('plan preferred days',()=>{
 it('formats structured days in both languages',()=>{
  expect(preferredDaysLabel(['fri','mon','wed'],'zh')).toBe('周一、三、五');
  expect(preferredDaysLabel(['fri','mon','wed'],'en')).toBe('Mon/Wed/Fri');
 });
 it('displays structured schedule without repeating an obsolete raw note',()=>{
  const version={id:'version',createdAt:'2026-10-12T00:00:00.000Z',origin:'coach_change',source:'ai',versionNumber:2,goalText:'练力量',weeklyTarget:3,preferredDays:['mon','wed','fri'],scheduleOriginalText:'旧聊天原话：改成每周两次',templates:[{id:'A',name:'A',estimatedMinutes:40,items:[]}]} as unknown as PlanVersion;
  const html=renderToStaticMarkup(createElement(PlanPage,{version,currentVersionId:version.id,language:'zh',exerciseName:(id:string)=>id,onVersions:()=>{},onExercises:()=>{},onExercise:()=>{}}));
  expect(html).toContain('周一、三、五');
  expect(html).not.toContain('旧聊天原话');
 });
});
