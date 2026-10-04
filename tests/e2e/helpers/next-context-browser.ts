import { createDatabase } from '../../../src/persistence/db';
import { createRepository } from '../../../src/persistence/repository';
import { createProfileService } from '../../../src/application/profile';
import { exercises, CATALOG_VERSION } from '../../../src/catalog/exercises';
import { confirmationFor, goalConfirmationFor } from '../../../src/backend/contracts';
export async function runContextContract() {
  const contextPath='/src/application/ai-context.ts', candidatePath='/src/application/ai-candidate-save.ts';
  let contextModule, candidateModule;
  try {contextModule=await import(/* @vite-ignore */ contextPath);candidateModule=await import(/* @vite-ignore */ candidatePath);} catch {return {feature:false};}
  const db=createDatabase(`next-context-${crypto.randomUUID()}`),repo=createRepository(db);
  try {
    await createProfileService(repo).initialize('en');
    const profile=await db.profiles.toCollection().first();
    await createProfileService(repo).saveProfile({locale:'en',timeZone:'UTC',units:'metric'},profile!.revision);
    const before=await db.metadata.toArray(),memo=await db.trainingMemo.toArray();
    const service=contextModule.createAiContextService(repo);
    const empty=await service.capture();
    const scoped=await service.capture({from:'2027-01-01',to:'2027-01-31',sources:['sessions'],maxUtf8Bytes:32000});
    const request={contractVersion:1,operation:'generate',requestId:crypto.randomUUID(),goalText:'strength',confirmedGoal:'strength',locale:'en',restoreGeneration:empty.restoreGeneration,dates:['2027-01-12'],timeZone:'UTC',catalogVersion:CATALOG_VERSION,conditions:{},goalConfirmation:'',sendConfirmation:''};
    request.goalConfirmation=await goalConfirmationFor(request);request.sendConfirmation=await confirmationFor(request);
    const item={exerciseId:exercises[2].id,order:0,targetSets:[{metricType:'reps',reps:10}]};
    const candidates=candidateModule.createAiCandidateService(repo);
    const token=await candidates.prepare(request,{days:[{date:request.dates[0],exercises:[item]}]});
    const readOnly=JSON.stringify(before)===JSON.stringify(await db.metadata.toArray())&&JSON.stringify(memo)===JSON.stringify(await db.trainingMemo.toArray())&&await db.plans.count()===0&&empty.history===undefined;
    await repo.write(async()=>{await db.bodyWeights.add({id:crypto.randomUUID(),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),revision:0,localDate:'2027-02-01',timeZone:'UTC',weightGrams:60000});});
    const saved=await candidates.save(token,[{date:request.dates[0],name:'AI day',exercises:[item]}]);
    const replay=await candidates.save(token,[{date:request.dates[0],name:'AI day',exercises:[item]}]).then(()=> 'accepted',(e:{code:string})=>e.code);
    return {feature:true,readOnly,historyExact:JSON.parse(scoped.history.text).dataRevision===scoped.history.sourceRevision&&scoped.manifest.utf8Bytes===new TextEncoder().encode(scoped.history.text).length,saved:saved.plan.source==='ai'&&saved.version.goalSnapshot.goal==='strength'&&saved.version.generationMetadata.requestId===request.requestId&&await db.plans.count()===1,replay};
  } finally {db.close();await db.delete();}
}

import { createAiContextService } from '../../../src/application/ai-context';
import { createAiCandidateService, type AiCandidateEdit, type GenerationAiRequest } from '../../../src/application/ai-candidate-save';
import { createWorkoutService } from '../../../src/application/workouts';
import { createDayPlanService } from '../../../src/application/day-plans';
import { createBackupService } from '../../../src/application/backup';
import { seedCalLibrary } from './cal-browser';
export async function runSafetyScenario(scenario:string) {
  const db=createDatabase(`next-context-safety-${crypto.randomUUID()}`),repo=createRepository(db);
  try {
    const profiles=createProfileService(repo);let profile=await profiles.initialize('en');
    profile=await profiles.saveProfile({locale:'en',timeZone:'UTC',units:'metric'},profile.revision);
    const contexts=createAiContextService(repo), candidates=createAiCandidateService(repo);
    const item:AiCandidateEdit['exercises'][number]={exerciseId:exercises[2].id as AiCandidateEdit['exercises'][number]['exerciseId'],order:0,targetSets:[{metricType:'reps',reps:10}]};
    const request=async(history=false):Promise<GenerationAiRequest>=>{
      const captured=await contexts.capture(history?{from:'2027-01-01',to:'2027-01-31',sources:['bodyWeights'],maxUtf8Bytes:32000}:undefined);
      const value:GenerationAiRequest={contractVersion:1,operation:'generate',requestId:crypto.randomUUID(),goalText:'fitness',confirmedGoal:'confirmed fitness',locale:'en',restoreGeneration:captured.restoreGeneration,dates:['2027-01-12'],timeZone:'UTC',catalogVersion:CATALOG_VERSION,conditions:{sessionMinutes:30},goalConfirmation:'',sendConfirmation:'',...(history?{history:captured.history}: {})};
      value.goalConfirmation=await goalConfirmationFor(value);value.sendConfirmation=await confirmationFor(value);return value;
    };
    const edits:AiCandidateEdit[]=[{date:'2027-01-12',name:'Confirmed AI',exercises:[item]}];
    const prepare=async(history=false)=>{const value=await request(history);return {value,token:await candidates.prepare(value,{days:[{date:value.dates[0],exercises:[item]}]})};};
    const code=async(operation:()=>Promise<unknown>)=>operation().then(()=> 'accepted',(error:{code?:string})=>error.code??'unexpected');
    const weights=async(date:string)=>repo.write(async()=>{const now=new Date().toISOString();await db.bodyWeights.add({id:crypto.randomUUID(),createdAt:now,updatedAt:now,revision:0,localDate:date,timeZone:'UTC',weightGrams:65000});});
    if(scenario==='ongoing-released'){
      const {token}=await prepare();const day=await createDayPlanService(repo).saveDayPlan({name:'Ongoing',date:'2027-01-12',timeZone:'UTC',exercises:[item]});
      await createWorkoutService(repo).startWorkout({sessionId:crypto.randomUUID(),localDate:'2027-01-12',timeZone:'UTC',scheduledWorkoutId:day.task.id});
      // Synthetic collision fixture: protected in-progress identity wins even when the task is hidden.
      await repo.write(async()=>{await db.scheduledWorkouts.put({...day.task,hiddenAt:new Date().toISOString()});});
      return {code:await code(()=>candidates.save(token,edits)),count:await db.plans.count()};
    }
    if(scenario==='legacy-profile'){
      const {token}=await prepare();await profiles.saveProfile({locale:'zh',timeZone:'UTC',units:'metric',trainingPreferences:{daysPerWeek:2,trainingWeekdays:[1,2],updatedAt:new Date().toISOString()}},profile.revision);
      return {code:await code(()=>candidates.save(token,edits)),count:await db.plans.count()};
    }
    if(scenario==='malformed-history'){
      const captured=await request(true);const invalids=[];
      for(const text of ['null','{}',JSON.stringify({...JSON.parse(captured.history!.text),range:{from:'bad',to:'2027-01-31'}}),JSON.stringify({...JSON.parse(captured.history!.text),sources:['backup']})]){
        const value=structuredClone(captured);value.history!.text=text;value.sendConfirmation=await confirmationFor(value);
        invalids.push(await code(()=>candidates.prepare(value,{days:[{date:value.dates[0],exercises:[item]}]})));
      }
      return {codes:invalids,count:await db.plans.count()};
    }
    if(scenario==='completed-hidden'){
      await seedCalLibrary(repo);const value=await request();value.dates=['2027-01-04'];value.sendConfirmation=await confirmationFor(value);
      const token=await candidates.prepare(value,{days:[{date:value.dates[0],exercises:[item]}]});
      return {code:await code(()=>candidates.save(token,[{...edits[0],date:value.dates[0]}])),count:await db.plans.count()};
    }
    if(scenario==='invalid-and-retry'){
      const {value,token}=await prepare();const before=(await repo.readMetadata()).dataRevision;
      const invalidDate=await code(()=>candidates.save(token,[{...edits[0],date:'2027-01-13'}]));
      const metrics=await code(()=>candidates.save(token,[{...edits[0],exercises:[{...item,targetSets:[{metricType:'duration',durationSeconds:30}]}]}]));
      const invalidCandidate=await code(()=>candidates.prepare(value,{days:[{date:'2027-01-13',exercises:[item]}]}));
      const malformed=await code(()=>candidates.save(token,[{...edits[0],exercises:[{...item,exerciseId:'not-catalog' as typeof item.exerciseId}]}]));
      const unchanged=before===(await repo.readMetadata()).dataRevision;
      await candidates.save(token,edits);return {invalidDate,metrics,invalidCandidate,malformed,unchanged,count:await db.plans.count()};
    }
    if(scenario==='restore'){
      const {token}=await prepare();await repo.write(async()=>{const metadata=await repo.readMetadata();await db.metadata.put({...metadata,restoreGeneration:1});});repo.adoptGeneration(1);
      return {code:await code(()=>candidates.save(token,edits)),count:await db.plans.count()};
    }
    if(scenario==='timezone'||scenario==='conditions'){
      const {token}=await prepare();await profiles.saveProfile({locale:'en',timeZone:scenario==='timezone'?'Asia/Shanghai':'UTC',units:'metric',...(scenario==='conditions'?{trainingPreferences:{sessionMinutes:45,updatedAt:new Date().toISOString()}}:{})},profile.revision);
      return {code:await code(()=>candidates.save(token,edits)),count:await db.plans.count()};
    }
    if(scenario==='slot'){
      const {token}=await prepare();await createDayPlanService(repo).saveDayPlan({name:'Manual occupies',date:'2027-01-12',timeZone:'UTC',exercises:[item]});
      return {code:await code(()=>candidates.save(token,edits)),count:await db.plans.count()};
    }
    if(scenario==='history'){
      const {token}=await prepare(true);await weights('2027-02-01');const unrelated=await code(()=>candidates.save(token,edits));
      // Another exact-date request in a free slot, selected history now changes.
      const value=await request(true);value.dates=['2027-01-13'];value.sendConfirmation=await confirmationFor(value);
      const next=await candidates.prepare(value,{days:[{date:value.dates[0],exercises:[item]}]});await weights('2027-01-02');
      return {unrelated,relevant:await code(()=>candidates.save(next,[{...edits[0],date:'2027-01-13'}])),count:await db.plans.count()};
    }
    if(scenario==='atomic'){
      const {token}=await prepare();const before=(await repo.readMetadata()).dataRevision;
      const original=db.scheduledWorkouts.add.bind(db.scheduledWorkouts);db.scheduledWorkouts.add=()=>{throw new DOMException('Synthetic storage quota','QuotaExceededError');};
      const failed=await code(()=>candidates.save(token,edits));db.scheduledWorkouts.add=original;
      const rolledBack=(await db.plans.count())===0&&(await db.planVersions.count())===0&&before===(await repo.readMetadata()).dataRevision;
      await candidates.save(token,edits);return {failed,rolledBack,count:await db.plans.count()};
    }
    if(scenario==='budget'){
      const before=(await repo.readMetadata()).dataRevision;const failed=await code(()=>contexts.capture({from:'2027-01-01',to:'2027-01-31',sources:['sessions'],maxUtf8Bytes:1}));
      return {failed,unchanged:before===(await repo.readMetadata()).dataRevision};
    }
    if(scenario==='fidelity'){
      await seedCalLibrary(repo);const backup=createBackupService(repo);const before=JSON.parse(await(await backup.exportBackup()).text()).data;const memoBefore=await db.trainingMemo.toArray();
      const {value,token}=await prepare();await candidates.save(token,edits);
      const replayToken=await candidates.prepare(value,{days:[{date:value.dates[0],exercises:[item]}]});const replay=await code(()=>candidates.save(replayToken,edits));
      const after=JSON.parse(await(await backup.exportBackup()).text()).data;
      const fields=['profiles','bodyWeights','sessions','sets','timers','mediaAssets','aiMemoryNotes'];
      const unchanged=JSON.stringify(memoBefore)===JSON.stringify(await db.trainingMemo.toArray())&&JSON.stringify(before.trainingMemo.sessions)===JSON.stringify(after.trainingMemo.sessions)&&fields.every(field=>JSON.stringify(before[field])===JSON.stringify(after[field]))&&['plans','planVersions','scheduledWorkouts'].every(field=>before[field].every((row:{id:string})=>JSON.stringify(row)===JSON.stringify(after[field].find((other:{id:string})=>other.id===row.id))));
      return {unchanged,replay,added:after.plans.length-before.plans.length};
    }
    throw new Error('Unknown scenario');
  } finally {db.close();await db.delete();}
}
