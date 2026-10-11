import {describe,it,expect} from 'vitest';
import {searchExercises,suggestExercises} from '../../src/catalog/catalog-service';
import {getExerciseGuide,getExerciseTags} from '../../src/catalog/exercise-guide';
import {catalogMetadata} from '../../src/catalog/registry';
import guides from '../../src/catalog/generated/guides-zh.json';
import {exercises,EXERCISE_IDS} from '../../src/catalog/exercises';
const id=(slug:string)=>[...catalogMetadata.values()].find(e=>e.slug===slug)!.id;
describe('shared exercise guidance',()=>{
 it('has 150 concrete Chinese guides with variant setup and actual catalogue IDs',()=>{
  expect(Object.keys(guides)).toHaveLength(150);
  for(const slug of Object.keys(guides)) {const guide=getExerciseGuide(id(slug),'zh');expect(guide.keyPoints.length).toBeGreaterThanOrEqual(2);expect(guide.keyPoints.length).toBeLessThanOrEqual(3);expect(guide.steps.length).toBeGreaterThanOrEqual(3);expect(guide.mistakes.length).toBeGreaterThan(0);expect(guide.cautions.length).toBeGreaterThan(0);expect(guide.media?.src).toMatch(/^\/exercise-media\/repdb\//);}
 });
 it('gives every catalogue entry a Chinese name and usable fallback without the old notice',()=>{for(const e of exercises){const g=getExerciseGuide(e.id,'zh');expect(g.name).toBeTruthy();expect(g.keyPoints.length).toBeGreaterThanOrEqual(2);expect(g.steps.join('')).not.toContain('详细说明为英文');}});
 it('preserves legacy prefix and returns independent guidance',()=>{expect(exercises[0].id).toBe(EXERCISE_IDS.gobletSquat);const g=getExerciseGuide(id('push-up'),'zh');g.steps[0]='changed';expect(getExerciseGuide(id('push-up'),'zh').steps[0]).not.toBe('changed');});
 it('finds Chinese aliases, punctuation-insensitive English and small typos',()=>{expect(searchExercises('掌上压').some(e=>e.id===id('push-up'))).toBe(true);expect(searchExercises('push up').some(e=>e.id===id('push-up'))).toBe(true);expect(searchExercises('bench pres').some(e=>e.id===id('bench-press'))).toBe(true);expect(suggestExercises('卧堆').length).toBeGreaterThan(0);});
 it('combines OR within filters with AND across filters',()=>{const result=searchExercises('',{places:['home','outdoor'],equipment:['dumbbell'],bodyParts:['arms','shoulders'],goals:['muscle']});expect(result.length).toBeGreaterThan(0);for(const e of result){const t=getExerciseTags(e.id);expect(t.equipment).toContain('dumbbell');expect(t.places.some(p=>p==='home'||p==='outdoor')).toBe(true);expect(t.bodyParts.some(p=>p==='arms'||p==='shoulders')).toBe(true);}});
 it('recognizes gym machines and yoga mats without requiring them for bodyweight work',()=>{expect(searchExercises('',{equipment:['gym-machine']}).some(e=>e.id===id('leg-press'))).toBe(true);expect(searchExercises('',{equipment:['yoga-mat']}).some(e=>e.id===id('plank'))).toBe(true);});
 it('rehab is a conservative low-intensity subset, without heavy or explosive exercises',()=>{const result=searchExercises('',{goal:'rehab'});expect(result.length).toBeGreaterThan(0);expect(result.some(e=>e.id===id('walking'))).toBe(true);expect(result.some(e=>['deadlift','jump-squat','snatch'].map(id).includes(e.id))).toBe(false);});
 it('caution sorting retains every matching entry',()=>{const ordinary=searchExercises(''),cautious=searchExercises('',{cautionAreas:['knees']});expect(cautious.map(e=>e.id).sort()).toEqual(ordinary.map(e=>e.id).sort());expect(getExerciseTags(cautious[0].id).cautionAreas).not.toContain('knees');});
 it('keeps the old locale/filter signature',()=>{const result=searchExercises('','en',{equipment:'dumbbell',metricType:'reps_load'});expect(result.length).toBeGreaterThan(0);expect(result.every(e=>e.equipment==='dumbbell'&&e.metricType==='reps_load')).toBe(true);});
});

