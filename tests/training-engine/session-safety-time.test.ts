import {scorePlan} from '../../src/engine/score';
import {describe,expect,it} from 'vitest';
import {generatePlan,validatePlan} from '../../src/engine';
import {Rules} from '../../src/engine/data';
import {prescriptionSchema,type EnginePlan} from '../../src/engine/contracts';
import {v8BackupSchema} from '../../src/domain/schemas';
import {EXERCISE_IDS} from '../../src/catalog/exercises';
import {baseProfile,equipmentScenarios} from '../../tools/eval/training-engine-profiles';
import {actualBlockSeconds,independentWarmupAudit,independentSessionTimeIssues,independentlyApplicableSessionTypes} from '../unit/engine/reference/training-engine-session-time';
import {classifyPlan} from '../../tools/eval/training-engine-audit';

const rules=new Rules(),minimum=rules.get('safety.session.warmup_cooldown'),moderate=rules.get('aerobic.intensity.rpe_scale').moderate as [number,number];
function fixture():EnginePlan{return {weeklyTarget:1,sessionMinutes:30,meta:{engineVersion:'fixture',rulesVersion:rules.data.rulesVersion,seed:'safety-time'},gates:[],notices:[],trace:[],templates:[{id:'actual-time',name:'合成处方',estimatedMinutes:30,estimatedSeconds:1800,items:[{exerciseId:EXERCISE_IDS.walking,equipment:'none',sets:1,target:{metricType:'duration',durationSeconds:600},prescription:{pattern:'cardio_cyclic',block:'conditioning',rir:[0,0],restSeconds:0,targetRpe:moderate}}]}]};}

describe('source-applicable safety warmup and cooldown measured from prescriptions',()=>{
 it('classifies actual circuit and explicit aerobic RPE, without inferring intensity from RIR or the goal',()=>{
  const plan=fixture(),template=plan.templates[0],prescription=template.items[0].prescription!;
  expect(independentlyApplicableSessionTypes(template)).toContain('aerobic_moderate_plus');
  prescription.targetRpe=[1,moderate[0]-1];expect(independentlyApplicableSessionTypes(template)).toEqual([]);
  prescription.targetRpe=[moderate[0]-1,moderate[0]];expect(independentlyApplicableSessionTypes(template)).toContain('aerobic_moderate_plus');
  prescription.structure='circuit';expect(independentlyApplicableSessionTypes(template)).toContain('circuit');
  template.durationScope='untargeted';expect(independentlyApplicableSessionTypes(template,baseProfile({population:{kind:'postpartum',weeksSinceBirth:3,delivery:'vaginal',cleared:false}}))).toEqual([]);
 });
 it('finds missing actual blocks even when displayed estimates claim enough total time',()=>{
  const plan=fixture();plan.templates[0].estimatedMinutes=90;plan.templates[0].estimatedSeconds=5400;
  expect(independentSessionTimeIssues(plan,baseProfile()).map(issue=>issue.code)).toEqual(['safety_warmup_duration','safety_cooldown_duration']);
 });
 it('computes bilateral timed work, sets and authored overhead rather than rounded minutes',()=>{
  const exercise=rules.data.exercises.find(exercise=>exercise.modality==='mobility'&&exercise.time.per_side)!;expect(exercise).toBeDefined();
  const template=fixture().templates[0];template.items=[{exerciseId:exercise.id,equipment:exercise.equipment_required[0],sets:2,target:{metricType:'duration',durationSeconds:30},prescription:{pattern:exercise.primary_pattern,block:'warmup',rir:[3,4],restSeconds:0,perSide:true}}];
  expect(actualBlockSeconds(template,'warmup')).toBe(2*(30*rules.get('session.time.model').per_side_multiplier+rules.get('duration.set.overhead').mobility_overhead_s_per_set));
 });
 it('keeps the actual five-minute warmup minimum separate from the default budget and retains the longer cooldown requirement',()=>{
  const plan=fixture(),exercise=rules.data.exercises.find(exercise=>exercise.modality==='mobility'&&!exercise.time.per_side)!,seconds=minimum.warmup_min_minutes*60-rules.get('duration.set.overhead').mobility_overhead_s_per_set;
  for(const block of ['warmup','cooldown'] as const)plan.templates[0].items.push({exerciseId:exercise.id,equipment:exercise.equipment_required[0],sets:1,target:{metricType:'duration',durationSeconds:seconds},prescription:{pattern:exercise.primary_pattern,block,rir:[3,4],restSeconds:0}});
  const profile=baseProfile({level:'intermediate',sessionMinutes:90}),issues=independentSessionTimeIssues(plan,profile),row=rules.get('duration.block.warmup_cooldown').by_session_min.find((row:{session:number})=>row.session===90);
  expect(row.warmup*60).toBe(540);
  expect(independentWarmupAudit(plan.templates[0],profile).seconds).toBe(300);
  expect(issues.map(issue=>issue.reason)).toEqual([`actual_cooldown_seconds:300<${row.cooldown*60}`]);
 });
 it('allows a genuine ten-minute circuit and scores its warmup and cooldown target shortfall',()=>{
  expect(rules.get('session.template.min10').slots.some((slot:{structure?:string})=>slot.structure==='circuit')).toBe(true);
  const plan=generatePlan(baseProfile({sessionMinutes:10}));expect(plan.templates.length).toBeGreaterThan(0);expect(validatePlan(plan,baseProfile({sessionMinutes:10})).filter(i=>i.severity==='error')).toEqual([]);const counter=fixture();expect(scorePlan(counter,baseProfile({sessionMinutes:10}),rules).perRule.find(v=>v.id==='safety.session.warmup_cooldown')!.satisfaction).toBe(0);
 });
 it('does not certify an obsolete target-only impossibility as an allowed empty plan',()=>{
  const profile=baseProfile({sessionMinutes:10}),issue={code:'session_safety_time_budget',ruleId:'safety.session.warmup_cooldown',severity:'error' as const,reason:'mandatory_warmup_cooldown_leave_no_work_time'},plan=fixture();plan.templates=[];plan.quality={status:'unavailable',basis:'source_constraint',issues:[issue]};rules.notice(plan.notices,'engine.copy.unavailable');
  expect(classifyPlan(plan,profile,[issue]).status).toBe('fail');
  expect(classifyPlan(plan,baseProfile({sessionMinutes:30}),[issue]).status).toBe('fail');
  const phase1=baseProfile({sessionMinutes:10,population:{kind:'postpartum',weeksSinceBirth:3,delivery:'vaginal',cleared:false}});expect(classifyPlan(plan,phase1,[issue]).status).toBe('fail');
  const arbitrary=[issue,{code:'duration_tolerance',ruleId:'duration.fit.tolerance',severity:'error' as const,reason:'estimated_duration_outside_tolerance'}];plan.quality.issues=arbitrary;expect(classifyPlan(plan,profile,arbitrary).status).toBe('fail');
 });
 it('scores every applicable generated session from real block prescriptions',()=>{
  let applicable=0;
  for(const daysPerWeek of [4,5,6]){const profile=baseProfile({goal:'fat_loss',level:'intermediate',trainingAgeWeeks:52,sessionMinutes:30,daysPerWeek,equipment:[...equipmentScenarios[4]],constraints:{noJump:false,quiet:false,space:'large'}}),plan=generatePlan(profile);
   for(const template of plan.templates){if(!independentlyApplicableSessionTypes(template).length)continue;applicable++;
    const warmup=independentWarmupAudit(template,profile);expect(warmup.issues,template.id).toEqual([]);
    expect(warmup.seconds,template.id).toBeGreaterThanOrEqual(0);
    expect(actualBlockSeconds(template,'cooldown'),template.id).toBeGreaterThanOrEqual(0);const row=scorePlan({...plan,templates:[template]},profile,rules).perRule.find(v=>v.id==='safety.session.warmup_cooldown')!;expect(row.satisfaction).toBeCloseTo((Math.min(1,warmup.seconds/(minimum.warmup_min_minutes*60))+Math.min(1,actualBlockSeconds(template,'cooldown')/(minimum.cooldown_min_minutes*60)))/2);
   }
  }
  expect(applicable).toBeGreaterThan(0);
 });
 it('does not impose the aerobic threshold on untargeted early postpartum walking',()=>{
  const profile=baseProfile({population:{kind:'postpartum',weeksSinceBirth:3,delivery:'vaginal',cleared:false},constraints:{noJump:false,quiet:false,space:'large'}}),plan=generatePlan(profile);
  expect(plan.templates.length).toBeGreaterThan(0);expect(plan.templates.every(template=>template.durationScope==='untargeted')).toBe(true);expect(independentSessionTimeIssues(plan,profile)).toEqual([]);
 });
 it('rejects invalid RPE bounds and order, and preserves valid RPE through backup JSON',()=>{
  const prescription=fixture().templates[0].items[0].prescription!;
  for(const targetRpe of [[-1,5],[5,11],[6,5]])expect(prescriptionSchema.safeParse({...prescription,targetRpe}).success).toBe(false);
  const at='2026-10-15T03:00:00.000Z',backup={state:{id:'v8',migratedAt:at,legacyPlanIds:[],notice:{planCount:0,acknowledged:true}},plans:[],planVersions:[],activities:[],workouts:[{id:'a1111111-1111-4111-8111-111111111111',startedAt:at,localDate:'2026-10-15',timeZone:'Asia/Shanghai',status:'in_progress',plannedSetCount:1,sets:[],templateSnapshot:fixture().templates[0]}]};
  const parsed=v8BackupSchema.parse(JSON.parse(JSON.stringify(backup)));expect(parsed.workouts[0].templateSnapshot?.items[0].prescription?.targetRpe).toEqual(moderate);
  for(const targetRpe of [[-1,5],[5,11],[6,5]]){const invalid=structuredClone(backup);invalid.workouts[0].templateSnapshot.items[0].prescription!.targetRpe=targetRpe as [number,number];expect(v8BackupSchema.safeParse(invalid).success).toBe(false);}
 });
});

it('does not let a forged untargeted flag or light RPE bypass circuit safety for a general profile',()=>{const p=baseProfile(),plan=fixture(),template=plan.templates[0],prescription=template.items[0].prescription!,light=rules.get('aerobic.intensity.rpe_scale').light_max;template.durationScope='untargeted';prescription.structure='circuit';prescription.targetRpe=[light,light];prescription.rir=[0,0];expect(independentlyApplicableSessionTypes(template,p)).toEqual(['circuit']);const external=independentSessionTimeIssues(plan,p);expect(external.map(i=>i.code)).toEqual(['external_untargeted_scope','safety_warmup_duration','safety_cooldown_duration']);expect(scorePlan(plan,p,rules).perRule.find(v=>v.id==='safety.session.warmup_cooldown')!.satisfaction).toBe(0);expect(validatePlan(plan,p).some(i=>i.ruleId==='safety.session.warmup_cooldown')).toBe(false);});
