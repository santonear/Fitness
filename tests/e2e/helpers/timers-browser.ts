import Dexie from 'dexie';
import { createDatabase } from '../../../src/persistence/db';
import { createRepository } from '../../../src/persistence/repository';
import { createProfileService } from '../../../src/application/profile';
import { createWorkoutService } from '../../../src/application/workouts';
import { createTimerService } from '../../../src/application/timers';
import { exercises } from '../../../src/catalog/exercises';
export async function verifyTimerWrites(name:string){
 const db=createDatabase(name),second=createDatabase(name);
 try{
  const repo=createRepository(db);await createProfileService(repo).initialize('en');
  const workouts=createWorkoutService(repo),timers=createTimerService(repo),other=createTimerService(createRepository(second));
  const session=await workouts.startWorkout({sessionId:crypto.randomUUID(),localDate:'2026-10-03',timeZone:'Asia/Shanghai',exerciseIds:[exercises[0].id]});
  const now=new Date().toISOString();const state={id:crypto.randomUUID(),sessionId:session.id,exerciseInstanceId:session.exerciseSnapshots[0].exerciseInstanceId,createdAt:now,updatedAt:now,revision:0,kind:'exercise' as const,status:'running' as const,startedAtMs:Date.now(),accumulatedMs:0};
  await timers.saveTimer(state);
  const writes=await Promise.allSettled([timers.saveTimer({...state,revision:1,status:'paused',accumulatedMs:1000,startedAtMs:undefined}),other.saveTimer({...state,revision:1,status:'stopped',accumulatedMs:2000,startedAtMs:undefined})]);
  const invalid=await timers.saveTimer({...state,id:crypto.randomUUID(),exerciseInstanceId:crypto.randomUUID()}).then(()=>false,e=>e.code==='INVALID');
  const row=(await timers.listTimers(session.id))[0];
  const moved=await timers.saveTimer({...row,revision:row?.revision+1,kind:'rest'}).then(()=>false,e=>e.code==='INVALID');
  await workouts.abandonWorkout(session.id,session.revision);
  const readonly=await timers.saveTimer({...state,id:crypto.randomUUID()}).then(()=>false,e=>e.code==='SESSION_READ_ONLY');
  return await db.transaction('r',db.tables,async()=>({count:await db.timers.count(),conflicts:writes.filter(r=>r.status==='rejected'&&r.reason.code==='CONFLICT').length,invalid,moved,readonly,sets:await db.sets.count(),memoSets:(await db.trainingMemo.toArray()).flatMap(m=>m.sessions).flatMap(s=>s.sets).length}));
 }finally{db.close();second.close();await Dexie.delete(name);}
}
