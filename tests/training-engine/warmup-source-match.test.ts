import {baseProfile as completeSyntheticProfile} from '../../tools/eval/training-engine-profiles';
import {expect,it} from 'vitest';
import {DATA,Rules} from '../../src/engine/data';
import {generatePlan} from '../../src/engine/pipeline';
import {scorePlan} from '../../src/engine/score';
import {prescribe} from '../../src/engine/dose';
import {runGates} from '../../src/engine/gates';
import {engineProfileSchema} from '../../src/engine/contracts';
import profiles from '../unit/engine/fixtures/v1-surplus-inputs.json';
const profile=completeJointReview(engineProfileSchema.parse({...profiles.find(row=>row.index===108)!.profile,screening:{...profiles.find(row=>row.index===108)!.profile.screening,cmrSymptoms:completeSyntheticProfile().screening.cmrSymptoms}}));
function bodyOnlyFixture(){
 const data=structuredClone(DATA);for(const e of data.exercises)if(e.mobility_type!=='dynamic')e.primaryMuscles=[];
 const r=new Rules(data),plan=generatePlan(profile,{rules:r});
 const pair=plan.templates.flatMap(t=>t.items).filter(i=>['main','accessory'].includes(i.prescription?.block??'')).flatMap(work=>{const e=r.byExercise.get(work.exerciseId)!;return r.data.exercises.filter(w=>w.mobility_type==='dynamic'&&w.use.includes('warmup')&&!!w.bodyPart&&w.bodyPart===e.bodyPart).map(w=>({work,w}));})[0];expect(pair).toBeDefined();
 const warm=prescribe(pair.w,profile,r,runGates(profile,r).restrictions,'warmup',1);warm.target={metricType:'duration',durationSeconds:r.get('session.warmup.dynamic').seconds[0]};
 plan.templates=[{...plan.templates[0],items:[structuredClone(pair.work),warm]}];return {data,r,plan};
}
it('credits an explicitly known body-region match when work primary-muscle metadata is empty',()=>{
 const {r,plan}=bodyOnlyFixture(),work=r.byExercise.get(plan.templates[0].items[0].exerciseId)!,warm=r.byExercise.get(plan.templates[0].items[1].exerciseId)!;expect(work.primaryMuscles).toEqual([]);expect(warm.bodyPart).toBeTruthy();expect(warm.bodyPart).toBe(work.bodyPart);
 const matched=scorePlan(plan,profile,r).perRule.find(row=>row.id==='session.warmup.dynamic')!;expect(matched).toBeDefined();
 const missing=structuredClone(r.data);for(const e of missing.exercises){delete e.bodyPart;e.primaryMuscles=[];}const unknown=scorePlan(plan,profile,new Rules(missing)).perRule.find(row=>row.id==='session.warmup.dynamic')!;expect(matched.satisfaction-unknown.satisfaction).toBeCloseTo(1/3,12);
});
it('does not credit an unknown body region or primary-muscle list as a match, while retaining the real warmup work',()=>{
 const {data,plan}=bodyOnlyFixture(),before=structuredClone(plan);for(const e of data.exercises){delete e.bodyPart;e.primaryMuscles=[];}const r=new Rules(data);
 const dynamic=plan.templates[0].items.filter(i=>i.prescription?.block==='warmup'&&r.byExercise.get(i.exerciseId)?.mobility_type==='dynamic');expect(dynamic).toHaveLength(1);expect(dynamic[0].target).toHaveProperty('durationSeconds');
 const row=scorePlan(plan,profile,r).perRule.find(row=>row.id==='session.warmup.dynamic')!;expect(row.satisfaction).toBeLessThanOrEqual(2/3);expect(plan).toEqual(before);
});

// Explicit synthetic negative answers for this positive-control fixture; raw legacy JSON stays untouched.
function completeJointReview<T extends {cautions:string[];screening:any;asOfDate?:string}>(p:T):T{if(!p.cautions.filter(j=>j!=='other').length)return p;const rules=new Rules(),joint=rules.get('redflag.joint_any'),back=rules.get('redflag.back'),shoulder=rules.get('redflag.shoulder'),keys=[...joint.items,...(p.cautions.includes('back')?[...back.emergency_items,...back.urgent_items]:[]),...(p.cautions.includes('shoulder')?[...shoulder.cardiac_route_items,...shoulder.prompt_medical_items]:[])],at=p.asOfDate+'T00:00:00.000Z';p.screening.redFlagReview={requiredAt:at,answeredAt:at,areas:p.cautions,questionKeys:keys,answers:Object.fromEntries(keys.map((k:string)=>[k,false]))};return p;}
