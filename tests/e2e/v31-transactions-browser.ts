import { createDatabase } from '../../src/persistence/db';
import { createRepository } from '../../src/persistence/repository';
import { createProfileService } from '../../src/application/profile';
import { createDayPlanService } from '../../src/application/day-plans';
import { createGuidedService } from '../../src/application/guided';
import { createBackupService } from '../../src/application/backup';
import { exercises } from '../../src/catalog/exercises';
import type { ProgramCandidate } from '../../src/domain/guided-contracts';

export async function transactions() {
  const db=createDatabase(`v31-transactions-${crypto.randomUUID()}`);const repo=createRepository(db);const profile=await createProfileService(repo).initialize('en');
  const days=createDayPlanService(repo);const guided=createGuidedService(repo);const backup=createBackupService(repo);
  const exercise=exercises.find(item=>item.metricType==='reps')!;
  const content=[{exerciseId:exercise.id as ProgramCandidate['days'][number]['exercises'][number]['exerciseId'],order:0,targetSets:[{metricType:'reps' as const,reps:8}],setTimings:[{durationSeconds:40,restSeconds:30}]}];
  const input=(date:string)=>({date,name:'manual',timeZone:profile.timeZone,exercises:content,startTime:'12:00',durationMinutes:30});
  const reject=async(fn:()=>Promise<unknown>)=>{try{await fn();return false}catch{return true}};
  try {
    const existing=await days.saveDayPlan(input('2099-01-03'));
    const collision=await reject(()=>days.saveDayPlans([input('2099-01-01'),input('2099-01-03')],0));
    const rollback=(await db.plans.count())===1;
    const before=JSON.stringify(await db.plans.get(existing.plan.id));
    const candidate:ProgramCandidate={id:crypto.randomUUID(),name:'new independent',goal:'strength',startDate:'2099-01-04',endDate:'2099-01-06',timeZone:profile.timeZone,days:['2099-01-04','2099-01-06'].map(date=>({date,exercises:content,startTime:'19:00',durationMinutes:30})),explanation:'fixture',createdAt:new Date().toISOString(),restoreGeneration:0,...await guided.captureDependencies()};
    await guided.retainCandidate(candidate,(await guided.read()).revision);
    // An unrelated local observation must not invalidate otherwise current dependencies.
    await guided.saveObservation({id:crypto.randomUUID(),kind:'waist',value:80,unit:'cm',localDate:'2099-01-01',timeZone:profile.timeZone,method:'self',createdAt:new Date().toISOString()},(await guided.read()).revision);
    const edited=structuredClone(candidate);edited.name='edited';edited.days[1].startTime='14:00';
    const ids=await guided.saveIndependentCandidate(edited,14);
    const preserved=JSON.stringify(await db.plans.get(existing.plan.id))===before;
    const duplicate=await reject(()=>guided.saveIndependentCandidate(edited,14));
    const times=(await db.scheduledWorkouts.toArray()).map(row=>row.startTime).sort();
    const malformed=structuredClone(candidate);malformed.id=crypto.randomUUID();malformed.days=[{...malformed.days[0],date:'2099-02-01',durationMinutes:1}];malformed.startDate=malformed.endDate='2099-02-01';
    await guided.retainCandidate(malformed,(await guided.read()).revision);
    const tooLong=await reject(()=>guided.saveIndependentCandidate(malformed,14));
    const stale=structuredClone(candidate);stale.id=crypto.randomUUID();stale.startDate=stale.endDate='2099-02-02';stale.days=[{...stale.days[0],date:'2099-02-02'}];await guided.retainCandidate(stale,(await guided.read()).revision);
    const exported=await backup.exportBackup();const checked=await backup.validateBackup(new File([exported],'fixture.json',{type:'application/json'}));
    await backup.importBackup(checked,{backupExported:true,replacementConfirmed:true,expectedRevision:checked.expectedRevision});repo.adoptGeneration((await repo.readMetadata()).restoreGeneration??0);
    const restoreBlocked=await reject(()=>guided.saveIndependentCandidate(stale,14));
    return {collision,rollback,preserved,duplicate,count:ids.length,times,tooLong,restoreBlocked,backupVersion:checked.envelope.schemaVersion};
  } finally {db.close();await db.delete()}
}
