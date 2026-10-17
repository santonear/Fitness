import {expect,it} from 'vitest';
import {Rules} from '../../src/engine/data';
import {prescribe,type Template} from '../../src/engine/dose';
import {sourceWarmupRamps,refreshWarmupRamps} from '../../src/engine/progression/legacy-warmup';
import {safety} from '../../src/engine/gates/strength-scoring';
import {baseProfile} from '../../tools/eval/training-engine-profiles';
import {independentSourceRampSeconds} from '../unit/engine/reference/training-engine-source-warmup';
const r=new Rules(),p=baseProfile({goal:'mobility',level:'intermediate',daysPerWeek:6,sessionMinutes:63}),s=safety(p,r);
function fixture(){const items=['single-leg-rdl-hold','custom-self-resisted-overhead-press','custom-self-resisted-pulldown'].map((slug,n)=>{const e=r.data.exercises.find(e=>e.slug===slug)!;expect(e).toBeDefined();const item=prescribe(e,p,r,s,'main',2);item.prescription!.sourcePosition=`main_${n+1}`;return item;});return {id:'real-fb-b',name:'',estimatedMinutes:63,items} as Template;}
it('does not erase a real main warmup because an unrelated auxiliary retains its origin position',()=>{
 const t=fixture(),target=t.items[1],before=sourceWarmupRamps(t,p,r).find(x=>x.exerciseId===target.exerciseId);expect(before?.seconds).toBeGreaterThan(0);
 const auxiliary=prescribe(r.data.exercises.find(e=>e.slug==='warrior-three')!,p,r,s,'accessory',2);auxiliary.prescription!.sourcePosition='core_1';t.items.push(auxiliary);
 const independent=independentSourceRampSeconds(t.items,p,63);expect(independent[1]).toBe(before!.seconds);
 expect(sourceWarmupRamps(t,p,r).find(x=>x.exerciseId===target.exerciseId)).toEqual(before);refreshWarmupRamps(t,p,r);expect(target.prescription!.warmupSeconds).toBe(independent[1]);
});
it('refuses duplicated bodyweight main identities and a main pattern that does not belong to an allowed source day',()=>{
 const duplicate=fixture();duplicate.items.push(structuredClone(duplicate.items[1]));expect(sourceWarmupRamps(duplicate,p,r)).toEqual([]);
 const wrong=fixture(),replacement=prescribe(r.data.exercises.find(e=>e.slug==='bodyweight-squat')!,p,r,s,'main',2);replacement.prescription!.sourcePosition='main_2';wrong.items[1]=replacement;expect(sourceWarmupRamps(wrong,p,r)).toEqual([]);
});
