import {expect,it} from 'vitest';
import {missingCorePatterns} from '../../../src/engine/improve';
import {Rules} from '../../../src/engine/data';
import {fixtureProfile,planFixture} from './fixtures';
const r=new Rules(),p=fixtureProfile;
function plan(patterns:string[],days=1){const value=planFixture(),model=value.templates[0].items[0];value.templates=Array.from({length:days},(_,day)=>({...value.templates[0],id:`day${day}`,items:patterns.map(pattern=>({...structuredClone(model),exerciseId:r.data.exercises.find(e=>e.primary_pattern===pattern)!.id,prescription:{...model.prescription!,block:'accessory' as const}}))}));return value;}
it('uses the one/two day core target independently of the two-day global coverage gate',()=>{expect([...missingCorePatterns(plan(['squat']),p,r)].sort()).toEqual(['anti_extension','anti_lateral_flexion','anti_rotation']);});
it('does not pursue both alternatives when one is already covered',()=>{expect([...missingCorePatterns(plan(['anti_extension','anti_rotation']),p,r)]).toEqual([]);});
it('requires all three anti patterns at three actual RT days',()=>{expect([...missingCorePatterns(plan(['anti_extension','anti_rotation'],3),p,r)]).toEqual(['anti_lateral_flexion']);});
it('does not add core demands to an uncleared postpartum profile or a non-RT plan',()=>{expect([...missingCorePatterns(plan(['squat']),{...p,population:{kind:'postpartum',weeksSinceBirth:3,delivery:'vaginal',cleared:false}},r)]).toEqual([]);const empty=planFixture();empty.templates=[];expect([...missingCorePatterns(empty,p,r)]).toEqual([]);});
it('honours the source secondary-pattern policy',()=>{const value=plan(['anti_extension','anti_rotation']),first=value.templates[0].items[0],e=r.byExercise.get(first.exerciseId)!,data=structuredClone(r.data);data.exercises.find(x=>x.id===e.id)!.primary_pattern='squat';data.exercises.find(x=>x.id===e.id)!.secondary_patterns=['anti_extension'];expect([...missingCorePatterns(value,p,new Rules(data))]).toEqual([]);});
