import {baseProfile} from '../../tools/eval/training-engine-profiles';
import {scorePlan} from '../../src/engine/score';
import {legacySampledProfile} from './v1-inputs';
import {expect,it} from 'vitest';
import {generatePlan,validatePlan} from '../../src/engine';
import {enginePlanSchema} from '../../src/engine/contracts';
import {Rules} from '../../src/engine/data';
import {safetyBlockMinimums} from '../../src/engine/progression/legacy-blocks';

import {independentWarmupAudit,independentSessionTimeIssues} from '../unit/engine/reference/training-engine-session-time';
const profile=legacySampledProfile(22);profile.screening.cmrSymptoms=baseProfile().screening.cmrSymptoms;completeJointReview(profile);const r=new Rules();
it('retains the original short pregnancy fixture with real whole-second prescriptions and a measured safety target',()=>{
 const plan=generatePlan(profile);expect(profile.sessionMinutes).toBe(15);expect(enginePlanSchema.safeParse(plan).success).toBe(true);
 for(const t of plan.templates){if(!safetyBlockMinimums(t,profile,r).applies)continue;
  const actual=independentWarmupAudit(t,profile).seconds;expect(actual).toBeGreaterThanOrEqual(0);if(actual<r.get('safety.session.warmup_cooldown').warmup_min_minutes*60)expect(scorePlan(plan,profile,r).perRule.find(row=>row.id==='safety.session.warmup_cooldown')!.satisfaction).toBeLessThan(1);
  for(const i of t.items)if('durationSeconds'in i.target){expect(i.target.durationSeconds).toBeGreaterThan(0);expect(Number.isInteger(i.target.durationSeconds)).toBe(true);}
 }
 expect(validatePlan(plan,profile).filter(i=>i.severity==='error')).toEqual([]);
});
it('counts additional actual general-warmup seconds without trusting a V1 minimum-fill proof or displayed time',()=>{
 const plan=generatePlan(profile),t=plan.templates.find(t=>safetyBlockMinimums(t,profile,r).applies&&t.items.some(i=>i.prescription?.block==='warmup'&&r.byExercise.get(i.exerciseId)?.modality==='cardio'))!;expect(t).toBeDefined();const item=t.items.find(i=>i.prescription?.block==='warmup'&&r.byExercise.get(i.exerciseId)?.modality==='cardio')!;expect(item).toBeDefined();const before=independentWarmupAudit(t,profile).seconds,exercise=r.byExercise.get(item.exerciseId)!,side=item.prescription?.perSide||exercise.time.per_side?r.get('session.time.model').per_side_multiplier:1;if(!('durationSeconds'in item.target))throw Error('Expected a real timed general warmup');item.target.durationSeconds+=2;expect(independentWarmupAudit(t,profile).seconds-before).toBe(item.sets*2*side);t.estimatedSeconds=1;t.estimatedMinutes=1;expect(independentWarmupAudit(t,profile).seconds-before).toBe(item.sets*2*side);item.target.durationSeconds=profile.sessionMinutes*60*2;expect(validatePlan(plan,profile).some(i=>i.code==='duration_tolerance'&&i.severity==='error')).toBe(true);
});

// Explicit synthetic negative answers for this positive-control fixture; raw legacy JSON stays untouched.
function completeJointReview<T extends {cautions:string[];screening:any;asOfDate?:string}>(p:T):T{if(!p.cautions.filter(j=>j!=='other').length)return p;const rules=new Rules(),joint=rules.get('redflag.joint_any'),back=rules.get('redflag.back'),shoulder=rules.get('redflag.shoulder'),keys=[...joint.items,...(p.cautions.includes('back')?[...back.emergency_items,...back.urgent_items]:[]),...(p.cautions.includes('shoulder')?[...shoulder.cardiac_route_items,...shoulder.prompt_medical_items]:[])],at=p.asOfDate+'T00:00:00.000Z';p.screening.redFlagReview={requiredAt:at,answeredAt:at,areas:p.cautions,questionKeys:keys,answers:Object.fromEntries(keys.map((k:string)=>[k,false]))};return p;}
