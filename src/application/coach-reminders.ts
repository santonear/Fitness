import { repository, type Repository } from '../persistence/repository';
import { defaultCoachPreferences, eligibleReminder, quietAt, userReminderSources, zonedMinute, type CoachLedger, type CoachPreferences, type ReminderContext, type ReminderRecord, type ReminderSource } from '../domain/coach-reminders';

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
    const [sessions,workouts,state]=await Promise.all([db.sessions.toArray(),db.v8Workouts.toArray(),db.v8State.get('v8')]);
    const result=userReminderSources(now,ledger.preferences);
    return {result,training:sessions.some(s=>s.status==='in_progress')||workouts.some(s=>s.status==='in_progress'),onboarding:!state?.coachProfile?.adultConfirmed&&!sessions.length&&!workouts.length};
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
  async function preferences(value?:CoachPreferences){return db.transaction('rw',db.tables,async()=>{const {ledger}=await state(Date.now());if(value){if(value.weekdays&&(!value.weekdays.every(d=>Number.isInteger(d)&&d>=1&&d<=7)||new Set(value.weekdays).size!==value.weekdays.length)||value.time&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(value.time))throw Error('INVALID_REMINDER_PREFERENCES');if(![0,1,2].includes(value.dailyLimit)||![value.quietStart,value.quietEnd].every(t=>/^([01]\d|2[0-3]):[0-5]\d$/.test(t)))throw Error('INVALID_REMINDER_PREFERENCES');new Intl.DateTimeFormat('en',{timeZone:value.timeZone});ledger.preferences={...value,timeZone:ledger.preferences.timeZone};}await db.coachDevice.put(ledger);return ledger;});}
  async function act(id:string,action:'opened'|'dismissed'|'snoozed',now=Date.now()){return db.transaction('rw',db.tables,async()=>{const {ledger}=await state(now);const record=ledger.records.find(r=>r.id===id);if(record?.status==='shown')record.status=action;if(action==='snoozed')ledger.snoozeUntil=Math.max(ledger.snoozeUntil,now+4*3600000);await db.coachDevice.put(ledger);});}
  return {evaluate,preferences,act};
}
export const coachReminderService=createCoachReminderService(repository);
