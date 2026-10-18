import {expect,it} from 'vitest';
import {enginePlanSchema,type EnginePlan} from '../../src/engine/contracts';
import {sessionTemplateSchema} from '../../src/coach/contracts';
import {v8BackupSchema} from '../../src/domain/schemas';
import {EXERCISE_IDS} from '../../src/catalog/exercises';

function fixture():EnginePlan{return {weeklyTarget:1,sessionMinutes:63,meta:{engineVersion:'fixture',rulesVersion:'fixture',seed:'target-contract'},gates:[],notices:[],trace:[],templates:[{id:'source-target',name:'Source target fixture',estimatedMinutes:20,targetMinutes:20,items:[{exerciseId:EXERCISE_IDS.walking,equipment:'none',sets:1,target:{metricType:'duration',durationSeconds:600}}]}]};}
function backup(plan:EnginePlan){const at='2026-10-15T03:00:00.000Z';return {state:{id:'v8',migratedAt:at,legacyPlanIds:[],notice:{planCount:0,acknowledged:true}},plans:[],planVersions:[],activities:[],workouts:[{id:'a1111111-1111-4111-8111-111111111111',startedAt:at,localDate:'2026-10-15',timeZone:'Asia/Shanghai',status:'in_progress',plannedSetCount:1,sets:[],templateSnapshot:plan.templates[0]}]};}

it('preserves an optional per-template target through engine, coach and backup JSON without changing the available duration',()=>{
 const plan=fixture(),before=structuredClone(plan),template=plan.templates[0];
 expect(enginePlanSchema.parse(JSON.parse(JSON.stringify(plan))).templates[0].targetMinutes).toBe(20);
 expect(sessionTemplateSchema.parse(JSON.parse(JSON.stringify(template))).targetMinutes).toBe(20);
 expect(v8BackupSchema.parse(JSON.parse(JSON.stringify(backup(plan)))).workouts[0].templateSnapshot?.targetMinutes).toBe(20);
 expect(plan).toEqual(before);expect(plan.sessionMinutes).toBe(63);
 delete template.targetMinutes;
 expect(enginePlanSchema.parse(plan).templates[0].targetMinutes).toBeUndefined();
 expect(sessionTemplateSchema.parse(template).targetMinutes).toBeUndefined();
 expect(v8BackupSchema.parse(backup(plan)).workouts[0].templateSnapshot?.targetMinutes).toBeUndefined();
});
it.each([1,9,91,20.5])('rejects malformed target %s in every serialized contract',target=>{
 const plan=fixture();plan.templates[0].targetMinutes=target;
 expect(enginePlanSchema.safeParse(plan).success).toBe(false);
 expect(sessionTemplateSchema.safeParse(plan.templates[0]).success).toBe(false);
 expect(v8BackupSchema.safeParse(backup(plan)).success).toBe(false);
});
it.each(['main','accessory'] as const)('preserves optional goal role %s and the authored position through all contracts',goalRole=>{
 const plan=fixture(),item=plan.templates[0].items[0];item.prescription={pattern:'cardio_cyclic',block:'main',rir:[3,4],restSeconds:90,sourcePosition:'main_3',goalRole};
 for(const restored of [enginePlanSchema.parse(plan).templates[0],sessionTemplateSchema.parse(plan.templates[0]),v8BackupSchema.parse(backup(plan)).workouts[0].templateSnapshot!]){
  expect(restored.items[0].prescription).toMatchObject({goalRole,sourcePosition:'main_3',block:'main'});
 }
 delete item.prescription.goalRole;expect(enginePlanSchema.parse(plan).templates[0].items[0].prescription?.goalRole).toBeUndefined();
 const malformed=JSON.parse(JSON.stringify(plan));malformed.templates[0].items[0].prescription.goalRole='ignore';
 expect(enginePlanSchema.safeParse(malformed).success).toBe(false);expect(sessionTemplateSchema.safeParse(malformed.templates[0]).success).toBe(false);expect(v8BackupSchema.safeParse(backup(malformed)).success).toBe(false);
});
