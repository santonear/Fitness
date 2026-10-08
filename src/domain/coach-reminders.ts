export type ReminderKind = 'workout' | 'completion' | 'encourage';
export type ReminderStatus = 'shown' | 'dismissed' | 'snoozed' | 'opened' | 'expired' | 'cancelled';
export interface CoachPreferences { enabled: boolean; dailyLimit: 0 | 1 | 2; quietStart: string; quietEnd: string; timeZone: string; side: 'left' | 'right' }
export interface ReminderSource { id: string; kind: ReminderKind; taskId?: string; versionId?: string; sessionId?: string; date: string; startTime?: string; timeZone: string; name?: string; from: number; until: number }
export interface ReminderRecord extends ReminderSource { profileId: string; generation: number; shownAt: number; day: string; status: ReminderStatus }
export interface CoachLedger { id: string; preferences: CoachPreferences; records: ReminderRecord[]; watermark: number; snoozeUntil: number; generation: number; initializedAt: number }
export interface ReminderContext { now: number; generation: number; profileId: string; foreground: boolean; focused: boolean; training: boolean; onboarding: boolean; chat: boolean; modal: boolean; idleSince: number }
const hour = 3600000;
export const defaultCoachPreferences = (timeZone: string): CoachPreferences => ({ enabled: true, dailyLimit: 2, quietStart: '22:00', quietEnd: '08:00', timeZone, side: 'right' });
export function zonedMinute(at: number, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone, year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(at);
  const get = (key: string) => parts.find(p => p.type === key)!.value;
  return { day: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}` };
}
/** Gap => null; repeated civil minute => earliest occurrence. Never uses device local getters. */
export function scheduledInstant(date: string, time: string, zone: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return null;
  const civil = Date.parse(`${date}T${time}:00Z`); if (!Number.isFinite(civil)) return null;
  try {
    const offsets = new Set<number>();
    for (let delta=-36;delta<=36;delta+=6) { const at=civil+delta*hour; const p=zonedMinute(at,zone); offsets.add(Date.parse(`${p.day}T${p.time}:00Z`)-at); }
    const matches=[...offsets].map(offset=>civil-offset).filter(at=>{const p=zonedMinute(at,zone);return p.day===date&&p.time===time;});
    return matches.length ? Math.min(...matches) : null;
  } catch { return null; }
}
export function quietAt(now: number, preferences: CoachPreferences) {
  const current=zonedMinute(now,preferences.timeZone).time;
  const {quietStart:start,quietEnd:end}=preferences;
  return start===end ? false : start<end ? current>=start&&current<end : current>=start||current<end;
}
export function eligibleReminder(sources: ReminderSource[], ledger: CoachLedger, context: ReminderContext): ReminderSource | undefined {
  const {now}=context,p=ledger.preferences;
  if(!p.enabled||p.dailyLimit===0||!context.foreground||!context.focused||context.training||context.onboarding||context.chat||context.modal||now<ledger.watermark||now<ledger.snoozeUntil||context.generation!==ledger.generation)return;
  let day:string;try { if(quietAt(now,p))return;day=zonedMinute(now,p.timeZone).day; }catch{return;}
  if(ledger.records.filter(r=>r.day===day).length>=p.dailyLimit)return;
  const rank={workout:0,completion:1,encourage:2};
  return [...sources].sort((a,b)=>rank[a.kind]-rank[b.kind]||a.from-b.from||a.id.localeCompare(b.id)).find(source=>{
    if(now<source.from||now>source.until||source.kind==='encourage'&&now-context.idleSince<60000)return false;
    if(ledger.records.some(r=>r.id===source.id||source.taskId&&r.taskId===source.taskId&&r.day===day))return false;
    if(ledger.records.some(r=>r.kind===source.kind&&now-r.shownAt<6*hour))return false;
    return true;
  });
}
