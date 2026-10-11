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


describe('variant correctness regressions',()=>{
 it('keeps the banded standing curl a leg curl, not an arm curl',()=>{const g=getExerciseGuide(id('banded-standing-curl'),'zh');expect(g.name).toBe('弹力带站姿腿弯举');expect(g.steps.join('')).toContain('脚踝');expect(g.steps.join('')).toContain('屈膝');expect(g.steps.join('')).not.toContain('向肩前');});
 it('retains band position and unilateral kettlebell setup',()=>{expect(getExerciseGuide(id('banded-hip-thrust'),'zh').steps[0]).toContain('膝上');expect(getExerciseGuide(id('kettlebell-kickstand-deadlift'),'zh').steps[0]).toContain('单手');expect(getExerciseGuide(id('kettlebell-squat'),'zh').steps[0]).toContain('双腿之间');});
 it('does not apply ordinary crunch sequencing to heel touches or dead bug',()=>{expect(getExerciseGuide(id('heel-touches'),'zh').steps[2]).toContain('另一侧');expect(getExerciseGuide(id('dead-bug'),'zh').steps[1]).toContain('对侧腿');expect(getExerciseGuide(id('walking-lunge'),'zh').steps[2]).toContain('向前');});
});

describe('complete filter taxonomy and caution order',()=>{
 it('includes actual cardio exercises while excluding non-cardio strength',()=>{const ids=searchExercises('',{bodyParts:['cardio']}).map(e=>e.id);for(const slug of ['running','stationary-bike','rowing-machine','air-bike','walking'])expect(ids).toContain(id(slug));expect(ids).not.toContain(id('barbell-row'));});
 it('includes loop bands in the general band choice without including dumbbells',()=>{const ids=searchExercises('',{equipment:['resistance-band']}).map(e=>e.id);expect(ids).toContain(id('banded-squat'));expect(ids).toContain(id('banded-hip-thrust'));expect(ids).not.toContain(id('db-squat'));expect(searchExercises('',{equipment:['loop-band']}).every(e=>e.equipment==='loop-band')).toBe(true);});
 it('distinguishes hand and forearm support without attaching wrist load to dead bug',()=>{expect(getExerciseTags(id('high-plank')).cautionAreas).toEqual(expect.arrayContaining(['shoulders','wrists']));expect(getExerciseTags(id('plank')).cautionAreas).toContain('shoulders');expect(getExerciseTags(id('plank')).cautionAreas).not.toContain('wrists');expect(getExerciseTags(id('side-plank')).cautionAreas).not.toContain('wrists');expect(getExerciseTags(id('dead-bug')).cautionAreas).not.toContain('wrists');});
 it('puts a hand-supported exact match behind forearm matches when the user notes wrist discomfort',()=>{const ordinary=searchExercises('high plank'),cautious=searchExercises('plank',{cautionAreas:['wrist']});expect(ordinary[0].id).toBe(id('high-plank'));expect(cautious.findIndex(e=>e.id===id('plank'))).toBeLessThan(cautious.findIndex(e=>e.id===id('high-plank')));expect(cautious.map(e=>e.id).sort()).toEqual(searchExercises('plank').map(e=>e.id).sort());});
 it('exposes real Chinese zero-result suggestions, retaining filter and caution ordering',()=>{expect(searchExercises('俯误错')).toHaveLength(0);const suggested=suggestExercises('俯误错',{equipment:['none']});expect(suggested.map(e=>e.id)).toContain(id('push-up'));expect(suggested.every(e=>e.equipment==='none')).toBe(true);expect(suggestExercises('俯误错',{equipment:['barbell']})).toHaveLength(0);const rows=suggestExercises('平板错错',{cautionAreas:['wrist']});expect(rows.length).toBeGreaterThan(0);let seenWrist=false;for(const e of rows){const has=getExerciseTags(e.id).cautionAreas.includes('wrists');if(has)seenWrist=true;else expect(seenWrist).toBe(false);}});
});
