import {expect,it} from 'vitest';
import {Rules} from '../../../src/engine/data';
import {scorePlan} from '../../../src/engine/score';
import {prescribe} from '../../../src/engine/dose';
import {runGates} from '../../../src/engine/gates';
import {baseProfile} from '../../../tools/eval/training-engine-profiles';
import {planFixture,sessionFixture} from './fixtures';
const rules=new Rules(),id='older.template.balance_required';
it.each([1,2,3,6])('scores actual balance days against min(available days, required days): %i available',days=>{
 const p=baseProfile({daysPerWeek:days,population:{kind:'older_adult',fallsAnswers:[false,false,false,false]},birthYearMonth:'1956-06'}),required=Math.min(days,rules.get(id).hard_balance_days_min);
 const e=rules.data.exercises.find(e=>e.slug==='custom-wall-supported-single-leg-stand')!;
 const balance=prescribe(e,p,rules,runGates(p,rules).restrictions,'balance',1);
 for(let completed=0;completed<=required;completed++){
  const plan={...planFixture(),weeklyTarget:days,templates:Array.from({length:days},(_,index)=>({...sessionFixture(),id:`day-${index}`,items:index<completed?[structuredClone(balance)]:sessionFixture().items}))};
  const before=structuredClone(plan),row=scorePlan(plan,p,rules).perRule.find(row=>row.id===id);
  expect(row?.satisfaction).toBeCloseTo(completed/required);expect(plan).toEqual(before);
 }
});
