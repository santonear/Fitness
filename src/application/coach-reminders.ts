import { repository, type Repository } from '../persistence/repository';
import { defaultCoachPreferences, eligibleReminder, quietAt, scheduledInstant, zonedMinute, type CoachLedger, type CoachPreferences, type ReminderContext, type ReminderRecord, type ReminderSource } from '../domain/coach-reminders';

export function createCoachReminderService(repo: Repository) {
  const db=repo.db;
  async function state(now: number) {
    const metadata=await repo.readMetadata();const profile=await db.profiles.get(metadata.localProfileId);
    if(!profile)throw Error('PROFILE_REQUIRED');
    const id=`coach:${profile.id}`;
    let ledger=await db.coachDevice.get(id);
    if(!ledger)ledger={id,preferences:defaultCoachPreferences(profile.timeZone),records:[],watermark:now,snoozeUntil:0,generation:metadata.restoreGeneration??0,initializedAt:now};
    if(ledger.generation!==(metadata.restoreGeneration??0)){
      ledger={...ledger,generation:metadata.restoreGeneration??0,initializedAt:now,records:ledger.records.map(r=>r.status==='shown'?{...r,status:'cancelled'}:r)};
    }
    return {ledger,profile,metadata};
  }
  async function sources(now:number,ledger:CoachLedger):Promise<{result:ReminderSource[];training:boolean;onboarding:boolean}> {
    const [plans,versions,tasks,sessions,guided]=await Promise.all([db.plans.toArray(),db.planVersions.toArray(),db.scheduledWorkouts.toArray(),db.sessions.toArray(),db.guidedStates.get('guided')]);
    const result:ReminderSource[]=[];
    for(const task of tasks){
      const version=versions.find(v=>v.id===task.planVersionId),plan=plans.find(p=>p.id===version?.planId);
      if(!version||!plan||plan.deletedAt||plan.status!=='active'||plan.currentVersionId!==version.id||task.hiddenAt||task.status!=='pending'||task.completedSessionId||!task.startTime)continue;
      if(guided?.programs.some(p=>p.taskIds.includes(task.id)&&p.status!=='active'))continue;
      if(sessions.some(s=>s.planVersionId===task.planVersionId&&s.plannedDayId===task.plannedDayId&&s.status==='in_progress'))continue;
      const at=scheduledInstant(task.scheduledDate,task.startTime,version.scheduleTimeZone);if(at===null)continue;
      if(zonedMinute(now,version.scheduleTimeZone).day!==task.scheduledDate)continue;
      result.push({id:`workout:${task.id}:${task.planVersionId}:${plan.revision}:${task.revision}:${task.scheduledDate}:${task.startTime}`,kind:'workout',taskId:task.id,versionId:version.id,date:task.scheduledDate,startTime:task.startTime,timeZone:version.scheduleTimeZone,name:plan.name,from:at-90*60000,until:at-30*60000});
    }
    for(const session of sessions)if(session.status==='completed'&&session.completedAt){
      const at=Date.parse(session.completedAt);if(at<ledger.initializedAt||at>now||now-at>3600000)continue;
      result.push({id:`completion:${session.id}`,kind:'completion',sessionId:session.id,date:session.localDate,timeZone:session.timeZone,from:at,until:at+3600000});
    }
    const day=zonedMinute(now,ledger.preferences.timeZone).day;
    result.push({id:`encourage:${day}`,kind:'encourage',date:day,timeZone:ledger.preferences.timeZone,from:now,until:now+60000});
    return {result,training:sessions.some(s=>s.status==='in_progress'),onboarding:!guided?.onboarding?.completed&&!sessions.length};
  }
  // Main DB transaction includes sources and device ledger: competing tabs cannot both claim.
  async function evaluate(context: Omit<ReminderContext,'generation'|'profileId'|'training'|'onboarding'>) {
    return db.transaction('rw',db.tables,async()=>{
      const {ledger,profile,metadata}=await state(context.now);
      if(context.now<ledger.watermark){await db.coachDevice.put(ledger);return {record:undefined,ledger,suppressed:true};}
      const snapshot=await sources(context.now,ledger);
      ledger.records=ledger.records.map(record=>{
        if(record.status!=='shown')return record;
        const source=snapshot.result.find(s=>s.id===record.id);
        if(!source)return {...record,status:'cancelled'};
        return context.now>record.until?{...record,status:'expired'}:record;
      });
      const candidate=eligibleReminder(snapshot.result,ledger,{...context,profileId:profile.id,generation:metadata.restoreGeneration??0,training:snapshot.training,onboarding:snapshot.onboarding});
      let record:ReminderRecord|undefined;
      if(candidate){record={...candidate,profileId:profile.id,generation:ledger.generation,shownAt:context.now,day:zonedMinute(context.now,ledger.preferences.timeZone).day,status:'shown'};ledger.records.push(record);}
      ledger.records=ledger.records.filter(r=>r.shownAt>=context.now-180*86400000);
      ledger.watermark=Math.max(context.now,ledger.watermark);await db.coachDevice.put(ledger);return {record,ledger,suppressed:snapshot.training||snapshot.onboarding||!ledger.preferences.enabled||ledger.preferences.dailyLimit===0||context.now<ledger.snoozeUntil||quietAt(context.now,ledger.preferences)};
    });
  }
  async function preferences(value?:CoachPreferences){return db.transaction('rw',db.tables,async()=>{const {ledger}=await state(Date.now());if(value){if(![0,1,2].includes(value.dailyLimit)||![value.quietStart,value.quietEnd].every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))throw Error('INVALID_REMINDER_PREFERENCES');new Intl.DateTimeFormat('en',{timeZone:value.timeZone});ledger.preferences={...value,timeZone:ledger.preferences.timeZone};}await db.coachDevice.put(ledger);return ledger;});}
  async function act(id:string,action:'opened'|'dismissed'|'snoozed',now=Date.now()){return db.transaction('rw',db.tables,async()=>{const {ledger}=await state(now);const record=ledger.records.find(r=>r.id===id);if(record?.status==='shown')record.status=action;if(action==='snoozed')ledger.snoozeUntil=Math.max(ledger.snoozeUntil,now+4*3600000);await db.coachDevice.put(ledger);});}
  return {evaluate,preferences,act};
}
export const coachReminderService=createCoachReminderService(repository);
