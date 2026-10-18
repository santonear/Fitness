import {expect,it} from 'vitest';
import {generatePlan,nextTargets} from '../../src/engine';
import {estimateSeconds} from '../../src/engine/fit';
import {Rules} from '../../src/engine/data';
import {baseProfile} from '../../tools/eval/training-engine-profiles';
import type {WorkoutRecord} from '../../src/domain/v8/contracts';

it('replays source-dosed day targets after a genuine fatigue dose change without rewriting the baseline',()=>{
 const p=baseProfile({goal:'start_moving',trainingAgeWeeks:52,sessionMinutes:80,equipment:['none','dumbbell'],daysPerWeek:3}),r=new Rules(),plan=generatePlan(p),before=structuredClone(plan);
 expect(plan.templates.some(t=>t.targetMinutes!==undefined)).toBe(true);
 const t=plan.templates[0],history:WorkoutRecord[]=[{id:'source-target-fatigue',templateId:t.id,localDate:'2026-10-14',timeZone:'Asia/Shanghai',status:'complete',startedAt:'2026-10-14T08:00:00Z',endedAt:'2026-10-14T09:00:00Z',plannedSetCount:t.items.reduce((n,i)=>n+i.sets,0),sets:t.items.flatMap((i,itemIndex)=>Array.from({length:i.sets},(_,setIndex)=>({exerciseId:i.exerciseId,itemIndex,setIndex,...i.target,completedAt:'2026-10-14T08:50:00Z'}))),checkin:{energyMotivation:1,poorSleepNights:3}}];
 const historyBefore=structuredClone(history),output=nextTargets(history,plan,p,{checkin:{energyMotivation:1,poorSleepNights:3,sorenessResolved:false}});
 expect(output.diff.length).toBeGreaterThan(0);
 for(const t of output.value.templates)if(t.targetMinutes!==undefined)expect(t.targetMinutes).toBe(before.templates.find(original=>original.id===t.id)!.targetMinutes);
 for(const t of output.value.templates){expect(t.estimatedSeconds).toBe(estimateSeconds(t,r));expect(t.estimatedMinutes).toBe(Math.ceil(estimateSeconds(t,r)/60));}expect(plan).toEqual(before);expect(history).toEqual(historyBefore);expect(output.value.sessionMinutes).toBe(80);
});
