import type { TimerState } from '../domain/models';
import { repository, type Repository } from '../persistence/repository';
import { timerStateSchema } from '../domain/schemas';
import { DomainError } from '../domain/errors';
export function createTimerService(repo: Repository) {
 async function saveTimer(input:TimerState):Promise<void>{
  const parsed=timerStateSchema.safeParse(input);
  if(!parsed.success)throw new DomainError('INVALID','Invalid timer');
  const state=parsed.data;
  await repo.write(async()=>{
   const session=await repo.db.sessions.get(state.sessionId);
   if(!session)throw new DomainError('INVALID','Timer workout not found');
   if(session.status!=='in_progress')throw new DomainError('SESSION_READ_ONLY','Timer requires an active workout');
   if(state.status==='running'&&(await repo.db.guidedStates.get('guided'))?.events.filter(item=>item.sessionId===state.sessionId&&['workout_paused','workout_resumed'].includes(item.action)).at(-1)?.action==='workout_paused')throw new DomainError('CONFLICT','Resume the workout before running its timer');
   if(!state.exerciseInstanceId||!session.exerciseSnapshots.some(e=>e.exerciseInstanceId===state.exerciseInstanceId))throw new DomainError('INVALID','Timer exercise not found');
   if((state.status==='running')!==(state.startedAtMs!==undefined))throw new DomainError('INVALID','Timer timestamp does not match status');
   if(state.kind==='rest'&&!state.targetMs)throw new DomainError('INVALID','Rest requires a duration');
   const existing=await repo.db.timers.get(state.id);
   if(existing&&(existing.sessionId!==state.sessionId||existing.exerciseInstanceId!==state.exerciseInstanceId||existing.kind!==state.kind||existing.createdAt!==state.createdAt))throw new DomainError('INVALID','Timer association cannot change');
   if(state.revision!==(existing?existing.revision+1:0))throw new DomainError('CONFLICT','Timer changed; reload before saving');
   if(!existing&&(await repo.db.timers.where('sessionId').equals(state.sessionId).toArray()).some(t=>t.exerciseInstanceId===state.exerciseInstanceId&&t.kind===state.kind))throw new DomainError('CONFLICT','Timer already exists; reload before saving');
   await repo.db.timers.put(state);
  });
 }
 return {saveTimer,listTimers:(sessionId:string)=>repo.db.timers.where('sessionId').equals(sessionId).toArray()};
}
export const timerService=createTimerService(repository);
export const saveTimer=timerService.saveTimer;
