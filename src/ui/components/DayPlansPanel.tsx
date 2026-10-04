import { repository } from '../../persistence/repository';
import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { Link } from 'react-router-dom';
import { database } from '../../persistence/db';
import { profileService } from '../../application/profile';
import { dayPlanService, slotTasks } from '../../application/day-plans';
import { evaluateSlot } from '../../domain/day-slot-policy';
import { dateInZone } from '../../application/progress';
import type { LocalProfile, Plan, ScheduledWorkout } from '../../domain/models';
import { DateCalendar } from './DateCalendar';
import { DayPlanEditor } from './DayPlanEditor';
import { dayPlanFeedback } from '../day-plan-feedback';
export function DayPlansPanel({locale}:{locale:'zh'|'en'}){
  const zh=locale==='zh';const [profile,setProfile]=useState<LocalProfile>();const [selected,setSelected]=useState<string[]>([]);const [visited,setVisited]=useState<string[]>([]);const [active,setActive]=useState('');
  const [occupied,setOccupied]=useState<string[]>([]);const [entries,setEntries]=useState<{plan:Plan;row:ScheduledWorkout;generation:number}[]>([]);const [error,setError]=useState('');
  async function refresh(){await database.transaction('r',database.tables,async()=>{const p=await profileService.getProfile();setProfile(p);if(!p)return;const plans=await database.plans.filter(plan=>plan.model==='date-day'&&!plan.deletedAt).toArray();const rows=await database.scheduledWorkouts.toArray();const generation=(await repository.readMetadata()).restoreGeneration??0;
    setEntries(rows.filter(row=>!row.hiddenAt&&plans.some(plan=>plan.currentVersionId===row.planVersionId)).map(row=>({row,generation,plan:plans.find(plan=>plan.currentVersionId===row.planVersionId)!})));
    try{const tasks=await slotTasks(repository,p.timeZone);setOccupied([...new Set(tasks.filter(task=>evaluateSlot([task],task.projectedDate).occupants.length).map(task=>task.projectedDate))]);setError('');}catch(reason){setError(dayPlanFeedback(reason,zh));}});}
  useEffect(()=>{let live=true;let subscription:ReturnType<ReturnType<typeof liveQuery>['subscribe']>|undefined;void profileService.initialize(locale).then(()=>{if(!live)return;subscription=liveQuery(()=>Promise.all([database.plans.toArray(),database.planVersions.toArray(),database.scheduledWorkouts.toArray(),database.sessions.toArray(),database.profiles.toArray()])).subscribe({next:()=>{if(live)void refresh().catch(reason=>setError(String(reason)));},error:reason=>{if(live)setError(String(reason));}});}).catch(reason=>{if(live)setError(String(reason));});return()=>{live=false;subscription?.unsubscribe();};},[]);
  function activate(date:string){setActive(date);setVisited(values=>values.includes(date)?values:[...values,date]);}
  return <section aria-label={zh?'日期训练计划':'Date training plans'} className="day-plans-panel"><h2>{zh?'日期训练计划':'Date training plans'}</h2>
    <p>{zh?'按具体日期独立安排。首期每次保存一天；多选后逐日编辑和保存，不会自动套用相同内容。':'Plan exact dates independently. Save one date at a time; multi-selection does not copy content or save other dates.'}</p>
    {profile&&<><DateCalendar locale={locale} today={dateInZone(Date.now(),profile.timeZone)} selected={selected} onChange={setSelected} onActive={activate} occupied={occupied} />
      <div className="day-selection-tabs">{selected.map(date=><button type="button" key={date} onClick={()=>activate(date)} aria-pressed={active===date}>{date}</button>)}</div>
      {visited.map(date=><div key={date} hidden={active!==date||!selected.includes(date)}><DayPlanEditor date={date} locale={locale} zone={profile.timeZone} onSaved={refresh} /></div>)}</>}
    {error&&<p role="alert">{error}</p>}
    <ul aria-label={zh?'日期计划':'Date plans'}>{entries.sort((a,b)=>a.row.scheduledDate.localeCompare(b.row.scheduledDate)).map(({plan,row,generation})=><DayTaskRow key={row.id} plan={plan} row={row} generation={generation} zh={zh} refresh={refresh} />)}</ul>
  </section>;
}
function DayTaskRow({plan,row,generation,zh,refresh}:{plan:Plan;row:ScheduledWorkout;generation:number;zh:boolean;refresh:()=>Promise<void>}){
  const [date,setDate]=useState(row.scheduledDate);const [busy,setBusy]=useState(false);const [error,setError]=useState('');
  useEffect(()=>{setDate(row.scheduledDate);},[row.scheduledDate]);
  async function run(action:()=>Promise<void>){setBusy(true);setError('');try{await action();await refresh();}catch(reason){setError(dayPlanFeedback(reason,zh));}finally{setBusy(false);}}
  return <li>{plan.name} · {row.originalDate} → {row.scheduledDate} · {row.completedSessionId?(zh?'已完成':'completed'):row.status==='skipped'?(zh?'已跳过':'skipped'):(zh?'待训练':'pending')}
    {!row.completedSessionId&&<><label>{zh?'日计划新日期':'New day plan date'}<input type="date" value={date} disabled={busy} onChange={event=>setDate(event.target.value)} /></label>
      <button disabled={busy} onClick={()=>{if(!window.confirm(zh?`改期到 ${date}？原日期 ${row.originalDate} 的统计归属仍保留。`:`Reschedule to ${date}? Original statistics remain attributed to ${row.originalDate}.`))return;void run(()=>dayPlanService.rescheduleDayPlan(row.id,date,row.revision,generation));}}>{zh?'改期日计划':'Reschedule day plan'}</button>
      <button disabled={busy||row.status==='skipped'} onClick={()=>{void run(()=>dayPlanService.skipDayPlan(row.id,row.revision,generation));}}>{zh?'跳过日计划':'Skip day plan'}</button>
      {row.status==='pending'&&<Link to={`/workout?scheduledWorkoutId=${encodeURIComponent(row.id)}`}>{zh?'开始日训练':'Start day workout'}</Link>}</>}
    <button disabled={busy} onClick={()=>{if(!window.confirm(zh?'隐藏此日程？历史与统计保留；已完成仍占槽，未完成释放日期槽。':'Hide this schedule? Facts and statistics remain; completed days retain their slot, unfinished days release it.'))return;void run(()=>dayPlanService.hideDayPlan(row.id,row.revision,generation));}}>{zh?'隐藏日计划':'Hide day plan'}</button>
    {error&&<p role="alert">{error}</p>}
  </li>;
}
