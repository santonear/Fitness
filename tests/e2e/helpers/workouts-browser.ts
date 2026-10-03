import Dexie from 'dexie';
import { createDatabase } from '../../../src/persistence/db';
import { createRepository } from '../../../src/persistence/repository';
import { createProfileService } from '../../../src/application/profile';
import { createWorkoutService } from '../../../src/application/workouts';
import { exercises } from '../../../src/catalog/exercises';
import { createTrainingMemoryService } from '../../../src/application/training-memory';
export async function verifyWorkoutTransactions(name:string) {
 const db=createDatabase(name), second=createDatabase(name);
 try {
  const repo=createRepository(db); await createProfileService(repo).initialize('en');
  const service=createWorkoutService(repo), other=createWorkoutService(createRepository(second));
  const input={sessionId:crypto.randomUUID(),localDate:'2026-10-03',timeZone:'Asia/Shanghai',exerciseIds:[exercises[0].id]};
  const starts=await Promise.allSettled([service.startWorkout(input),other.startWorkout({...input,sessionId:crypto.randomUUID()})]);
  const session=(await db.sessions.toArray())[0]; const instance=session.exerciseSnapshots[0].exerciseInstanceId;
  const set={id:crypto.randomUUID(),exerciseInstanceId:instance,order:0,metricType:'reps_load' as const,reps:12,loadGrams:2500,completed:true,notes:'steady'};
  const saved=await Promise.allSettled([service.recordSet(session.id,set,session.revision),other.recordSet(session.id,{...set,id:crypto.randomUUID()},session.revision)]);
  const current=(await db.sessions.get(session.id))!;
  const retried=await service.startWorkout(input);if(retried.id!==session.id||await db.sessions.count()!==1)throw new Error('Repeated start created facts');
  const acknowledged=await service.recordSet(session.id,set,session.revision);if(acknowledged.revision!==current.revision||await db.sets.count()!==1)throw new Error('Repeated set created facts');
  const mismatch=await service.recordSet(session.id,{...set,id:crypto.randomUUID(),metricType:'duration',reps:undefined,loadGrams:undefined,durationSeconds:30},current.revision).then(()=>false,e=>e.code==='INVALID');
  const before=JSON.stringify([await db.sessions.toArray(),await db.sets.toArray(),await db.trainingMemo.toArray(),await repo.readMetadata()]);
  const original=db.trainingMemo.put.bind(db.trainingMemo);db.trainingMemo.put=()=>Dexie.Promise.reject(new Error('memo write failure'));
  await service.recordSet(session.id,{...set,id:crypto.randomUUID(),order:1},current.revision).catch(()=>{});db.trainingMemo.put=original;
  const rolledBack=before===JSON.stringify([await db.sessions.toArray(),await db.sets.toArray(),await db.trainingMemo.toArray(),await repo.readMetadata()]);
  const replacement={type:'replace_exercise' as const,exerciseInstanceId:instance,exerciseId:exercises[1].id,confirmClearMetrics:false};
  const replacementConfirmed=await service.adjustWorkout(session.id,replacement,current.revision).then(()=>false,e=>e.code==='INVALID');
  const replaced=await service.adjustWorkout(session.id,{...replacement,confirmClearMetrics:true},current.revision);
  const cleared=(await db.sets.get(set.id))!;
  if(cleared.completed||cleared.reps!==undefined||cleared.loadGrams!==undefined||cleared.metricType!=='duration_distance'||replaced.exerciseSnapshots[0].targetSets.length)throw new Error('Replacement retained incompatible metrics');
  const recorded=await service.recordSet(session.id,{id:set.id,exerciseInstanceId:instance,order:0,metricType:'duration_distance',durationSeconds:120,distanceMeters:150,completed:true,notes:'steady'},replaced.revision);
  const done=await service.completeWorkout(session.id,recorded.revision);await service.completeWorkout(session.id,current.revision);
  const readonly=await service.recordSet(session.id,set,done.revision).then(()=>false,e=>e.code==='SESSION_READ_ONLY');
  const temporary=await service.startWorkout({...input,sessionId:crypto.randomUUID()});
  const changed=await service.adjustWorkout(temporary.id,{...replacement,exerciseInstanceId:temporary.exerciseSnapshots[0].exerciseInstanceId,confirmClearMetrics:true},temporary.revision);
  const originalPreserved=changed.originalExerciseSnapshots[0].exerciseId===exercises[0].id;
  await service.abandonWorkout(changed.id,changed.revision);
  await db.transaction('rw',db.trainingMemo,async()=>{await db.trainingMemo.clear();});const memo=await createTrainingMemoryService(repo).readTrainingMemo();
  // Await transaction completion before closing: WebKit can finish a request
  // before its transaction releases the database handle.
  return await db.transaction('r',db.tables,async()=>({starts:starts.filter(r=>r.status==='fulfilled').length,conflicts:saved.filter(r=>r.status==='rejected'&&r.reason.code==='CONFLICT').length,sets:await db.sets.count(),memoSets:memo.sessions.reduce((n,s)=>n+s.sets.length,0),rolledBack,completed:done.status==='completed',readonly,mismatch,replacementConfirmed,originalPreserved,abandoned:memo.sessions.some(s=>s.session.status==='abandoned'),rebuilt:memo.sessions.length===2}));
 } finally {db.close();second.close();await Dexie.delete(name);}
}
