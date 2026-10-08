import { AppIcon, StatusIcon } from '../components/AppIcon';
import { useEffect, useState } from 'react';
import { liveQuery } from 'dexie';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { database } from '../../persistence/db';
import { profileService } from '../../application/profile';
import { workoutService } from '../../application/workouts';
import { dateInZone, progressService } from '../../application/progress';
import { exercises } from '../../catalog/exercises';
import type { Plan, PlanVersion, ScheduledWorkout, WorkoutSession, ProgressReport } from '../../domain/models';
import { calendarTask, type CalendarTask } from '../calendar-projection';

type Snapshot = { today: string; timeZone: string; tasks: CalendarTask[]; plans: Plan[]; versions: PlanVersion[]; active?: WorkoutSession; report: ProgressReport };
export function TodayPage() {
  const { i18n } = useTranslation(); const zh = i18n.resolvedLanguage === 'zh';
  const [data,setData] = useState<Snapshot>(); const [error,setError] = useState('');
  useEffect(() => {
    let alive=true;let stop=()=>{};
    void profileService.initialize(zh?'zh':'en').then(() => {
      if(!alive)return;
      const subscription=liveQuery(async () => {
        const profile=(await profileService.getProfile())!;const today=dateInZone(Date.now(),profile.timeZone);
        const from=new Date(Date.parse(`${today}T00:00:00Z`)-29*86400000).toISOString().slice(0,10);
        const versions=await database.planVersions.toArray();
        return {today,timeZone:profile.timeZone,tasks:(await workoutService.listAvailableSchedule()).map(task=>calendarTask(task,versions,profile.timeZone)),plans:await database.plans.toArray(),versions,active:await workoutService.getActiveWorkout(),report:await progressService.queryProgress({from,to:today,timeZone:profile.timeZone},Date.now())};
      }).subscribe({next:value=>setData(value),error:reason=>setError(String(reason))});stop=()=>subscription.unsubscribe();
    }).catch(reason=>setError(String(reason)));
    return()=>{alive=false;stop()};
  },[]);
  if(!data)return <p role={error?'alert':'status'}>{error||(zh?'正在读取本地训练…':'Loading local training…')}</p>;
  const tasks=data.tasks.filter(task=>task.calendarDate!==null).sort((a,b)=>a.calendarDate!.localeCompare(b.calendarDate!)||(a.startTime??'99').localeCompare(b.startTime??'99'));
  const current=tasks.find(task=>task.calendarDate===data.today);const upcoming=tasks.filter(task=>task.calendarDate!>data.today).slice(0,3);
  const uncertain=data.tasks.filter(task=>task.calendarDate===null);
  const currentDay=current&&data.versions.find(version=>version.id===current.planVersionId)?.days.find(day=>day.dayId===current.plannedDayId);
  function name(task:ScheduledWorkout){const version=data!.versions.find(item=>item.id===task.planVersionId);return data!.plans.find(item=>item.id===version?.planId)?.name??(zh?'训练安排':'Scheduled workout')}
  const weights=[...data.report.bodyWeights].sort((a,b)=>a.localDate.localeCompare(b.localDate));const change=weights.length>1?(weights.at(-1)!.weightGrams-weights[0].weightGrams)/1000:undefined;
  return <div className="v31-today"><Link to="/onboarding">{zh ? '继续或查看新手引导' : 'Continue or review onboarding'}</Link>
    <section className="v31-hero"><span className="v31-eyebrow">{zh?'TODAY · 今日训练':'TODAY · YOUR TRAINING'}</span><h1>{data.active?(zh?'继续这一场训练。':'Pick up where you left off.'):current?(zh?'今天的安排，准备开始。':'Your next workout starts here.'):(zh?'按自己的节奏，开始今天。':'Make today your own.')}</h1><p>{data.active?(zh?'进行中的训练和已保存的组记录都还在。':'Your active workout and saved sets are ready.'):current?name(current):(zh?'今天还没有训练安排。你可以创建计划，也可以直接记录一次临时训练。':'Nothing scheduled today. Create a plan or start a temporary workout.')}</p>
    {!data.active&&current&&<div className="v31-actions"><span className="v31-pill">{current.startTime??(zh?'时间未设置':'Time not set')}{current.sourceTimeZone!==data.timeZone?` · ${current.sourceTimeZone}`:''}</span>{current.durationMinutes&&<span className="v31-pill">{current.durationMinutes} {zh?'分钟':'min'}</span>}</div>}
    {data.active?<p className="v31-workout-summary">{data.active.exerciseSnapshots.map(item=>`${item.name[zh?'zh':'en']} × ${item.targetSets.length} ${zh?'组':'sets'}`).join(' · ')}</p>:currentDay&&<p className="v31-workout-summary">{currentDay.exercises.map(item=>`${exercises.find(exercise=>exercise.id===item.exerciseId)?.name[zh?'zh':'en']??item.exerciseId} × ${item.targetSets.length} ${zh?'组':'sets'}`).join(' · ')}</p>}
    <div className="v31-actions"><Link className="v31-button v31-primary" to={data.active?'/workout':current?`/workout?scheduledWorkoutId=${current.id}`:'/plans?tab=create'}>{data.active?(zh?'继续训练':'Continue workout'):current?(zh?'开始训练':'Start workout'):(zh?'创建训练计划':'Create a plan')}</Link><Link className="v31-button" to="/plans">{zh?'查看日历':'View calendar'}</Link><Link className="v31-button" to="/workout">{zh?'临时训练':'Temporary workout'}</Link></div></section>
    {error&&<p role="alert"><StatusIcon status="error"/>{error}</p>}
    {!!uncertain.length&&<p role="status"><AppIcon name="info"/>{zh?`${uncertain.length} 个安排的日期在当前时区无法确定，未放入今日或后续日期。`:`${uncertain.length} schedules need time-zone review and are not assigned to Today or upcoming dates.`} <Link to="/plans">{zh?'复核日历':'Review calendar'}</Link></p>}
    <div className="v31-grid"><section className="v31-card wide"><h2>{zh?'接下来':'Next up'}</h2><p>{zh?'只显示最近的安排，完整日历在 Plans 中。':'Your nearest sessions. Find the full calendar in Plans.'}</p><ul className="v31-list">{upcoming.map(task=><li key={task.id} className="v31-item"><div><strong>{task.calendarDate} · {name(task)}</strong><small>{task.startTime??(zh?'时间未设置':'Time not set')}{task.sourceTimeZone!==data.timeZone?' · '+task.sourceTimeZone:''}{task.durationMinutes?` · ${task.durationMinutes} ${zh?'分钟':'min'}`:''}</small></div><Link to={`/plans?date=${task.calendarDate}`}>{zh?'查看':'View'}</Link></li>)}</ul>{!upcoming.length&&<p>{zh?'还没有后续安排。休息日也可以留白。':'No upcoming sessions. It is fine to leave room for rest.'}</p>}</section>
    <section className="v31-card narrow"><h2>{zh?'最近 30 天':'Last 30 days'}</h2><strong className="v31-stat">{data.report.history.filter(s=>s.status==='completed').length}</strong><span className="v31-muted">{zh?'已完成训练':'Completed workouts'}</span><strong className="v31-stat">{data.report.historySets.some(set=>set.completed&&set.durationSeconds!==undefined)?Math.round(data.report.totals.durationSeconds/60):'—'} {zh?'分钟':'min'}</strong><span className="v31-muted">{zh?'已记录的动作时长':'Recorded exercise duration'}</span><strong className="v31-stat">{change===undefined?'—':`${change>0?'+':''}${change.toFixed(1)} kg`}</strong><span className="v31-muted">{zh?'体重变化；不足两次观测时不计算':'Weight change; requires two observations'}</span></section>
    <section className="v31-card ai-card"><h2>{zh?'AI 制定计划':'Plan with AI'}</h2><p>{zh?'确认目标、选择日期、核对发送信息，最后审阅并保存。':'Confirm your goal, choose dates, review what is sent, then preview and save.'}</p><div className="v31-actions"><Link className="v31-button v31-primary" to="/ai">{zh?'用 AI 创建计划':'Create with AI'}</Link><Link className="v31-button" to="/trial">{zh?'查看试用额度':'View trial access'}</Link></div></section>
    <section className="v31-card"><h2>{zh?'记录留在你的设备':'Your records stay here'}</h2><p>{zh?'本地训练不依赖 AI 资格。请定期将完整备份保管到浏览器以外。':'Local workouts do not depend on AI access. Keep complete backups outside this browser.'}</p><div className="v31-actions"><Link className="v31-button" to="/progress">{zh?'查看训练进度':'View progress'}</Link><Link className="v31-button" to="/settings?tab=backup">{zh?'备份数据':'Back up data'}</Link></div></section></div>
  </div>;
}
