import { withLegacyConfirmation } from '../legacy-confirmation';
import { database } from '../../persistence/db';
import { dateInZone } from '../../application/progress';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { workoutService } from '../../application/workouts';
import { profileService } from '../../application/profile';
import { exercises } from '../../catalog/exercises';
import type { WorkoutSession, SetRecord, Locale, ScheduledWorkout } from '../../domain/models';
import { CompletionReview, WorkoutFacts } from '../components/CompletionReview';
import { ExerciseEditor } from '../components/ExerciseEditor';

export function WorkoutPage({ dashboard = false }: { dashboard?: boolean }) {
  const { i18n } = useTranslation();
  const locale: Locale = i18n.resolvedLanguage === 'zh' ? 'zh' : 'en';
  const zh = locale === 'zh';
  const [params] = useSearchParams();
  const requested = params.get('scheduledWorkoutId');
  const [session, setSession] = useState<WorkoutSession>();
  const [sets, setSets] = useState<SetRecord[]>([]);
  const [schedule, setSchedule] = useState<ScheduledWorkout[]>([]);
  const [choose, setChoose] = useState<string>(exercises[0].id);
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [calendarZone, setCalendarZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const locked = useRef(false);

  async function refresh() {
    const profile = await profileService.getProfile(); if (profile) setCalendarZone(profile.timeZone);
    const active = await workoutService.getActiveWorkout();
    setSession(active);
    setSets(active ? await workoutService.getSets(active.id) : []);
    setSchedule(await workoutService.listAvailableSchedule());
  }

  useEffect(() => {
    void profileService.initialize(locale).then(refresh).catch(reason => setError(reason.message));
  }, []);

  async function run(action: () => Promise<WorkoutSession>, status = '') {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const next = await action();
      setSession(next);
      setSets(await workoutService.getSets(next.id));
      setSchedule(await workoutService.listAvailableSchedule());
      setMessage(status);
    } catch (reason) {
      setError(`${(reason as { code?: string }).code ?? 'INVALID'}: ${(reason as Error).message}`);
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }

  function start(scheduledWorkoutId?: string) {
    void run(async () => {
      const profile=await profileService.getProfile();const timeZone=profile!.timeZone;const localDate=dateInZone(Date.now(),timeZone);
      const input={sessionId:crypto.randomUUID(),localDate,timeZone,...(scheduledWorkoutId?{scheduledWorkoutId}:{exerciseIds:[choose]})};
      if(scheduledWorkoutId){const row=await database.scheduledWorkouts.get(scheduledWorkoutId);const version=row&&await database.planVersions.get(row.planVersionId);
        if(version&&'durationWeeks' in version)return withLegacyConfirmation({type:'start',versionId:version.id,dayId:row!.plannedDayId},zh,confirmation=>workoutService.startWorkout({...input,legacyConfirmation:confirmation}));}
      return workoutService.startWorkout(input);
    });
  }
  function abandon() {
    if (!session || !window.confirm(zh
      ? '放弃本次训练？已保存内容将保留并标为已放弃。'
      : 'Abandon this workout? Saved facts remain marked abandoned.')) return;
    void run(() => workoutService.abandonWorkout(session.id, session.revision), zh ? '训练已放弃' : 'Workout abandoned');
  }

  const exerciseChoice = (
    <label>
      {zh ? '选择动作' : 'Choose exercise'}
      <select value={choose} disabled={busy} onChange={event => setChoose(event.target.value)}>
        {exercises.map(exercise => <option key={exercise.id} value={exercise.id}>{exercise.name[locale]}</option>)}
      </select>
    </label>
  );

  function workspace() {
    if (!session) {
      const available = schedule.filter(row => !requested || row.id === requested);
      const selected = exercises.find(exercise => exercise.id === choose)!;
      const date = new Date(`${dateInZone(Date.now(),calendarZone)}T12:00:00Z`);
      const weekdays = zh ? ['一', '二', '三', '四', '五', '六', '日'] : ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
      const scheduleContent = <>
        <div className="dashboard-section-heading">
          <h2>{zh ? '计划日程' : 'Planned schedule'}</h2>
          {dashboard && <Link className="dashboard-link" to="/plans">{zh ? '查看计划' : 'View plans'} ↗</Link>}
        </div>
        {dashboard && <div className="dashboard-week" aria-label={zh ? '本周日历' : 'This week'}>
          {weekdays.map((day, index) => {
            const value = new Date(date);
            value.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7 + index);
            const localDate = value.toISOString().slice(0,10);
            return <div key={index} className={index === (date.getUTCDay() + 6) % 7 ? 'is-today' : ''}>
              <span>{day}</span><b>{value.getUTCDate()}</b><i className={available.some(row => row.scheduledDate === localDate) ? 'has-session' : ''} />
            </div>;
          })}
        </div>}
        {available.map(row => <div className="dashboard-schedule-row" key={row.id}>
          <p>{row.originalDate === row.scheduledDate ? row.scheduledDate : `${row.originalDate} → ${row.scheduledDate}`}</p>
          <button disabled={busy} onClick={() => start(row.id)}>{zh ? '开始计划训练' : 'Start planned workout'}</button>
        </div>)}
        {dashboard && available.length === 0 && <div className="dashboard-schedule-empty">
          <h3>{zh ? '安排你的训练周' : 'Build your training week'}</h3>
          <p className="muted">{zh ? '暂无可开始的计划训练。查看计划，安排接下来的练习。' : 'No planned sessions available. View your plans to organize what comes next.'}</p>
          <Link className="dashboard-secondary-link" to="/plans">{zh ? '查看训练计划' : 'Explore plans'} →</Link>
        </div>}
        {dashboard && <p className="dashboard-schedule-note">{zh ? '漏练不会自动改期，可手动安排补练。' : 'Missed sessions are rescheduled manually.'}</p>}
      </>;
      return dashboard ? <div className="dashboard-workspace">
        <section className="dashboard-workout" aria-label={zh ? '今日训练入口' : 'Today’s workout'}>
          <div className="dashboard-section-heading"><p className="dashboard-eyebrow">{zh ? '今日训练' : 'TODAY’S WORKOUT'}</p><span className="dashboard-badge">{zh ? '临时训练' : 'Temporary workout'}</span></div>
          <h2>{selected.name[locale]}</h2>
          <p className="dashboard-workout-meta">{zh ? { strength: '力量', cardio: '有氧', bodyweight: '徒手' }[selected.category] : { strength: 'Strength', cardio: 'Cardio', bodyweight: 'Bodyweight' }[selected.category]}</p>
          <p className="dashboard-workout-copy">{zh ? '选择一个动作开始训练，逐组记录实际完成值。' : 'Choose an exercise and start a session. Record actual values as you go.'}</p>
          {exerciseChoice}
          <button className="dashboard-start" disabled={busy} onClick={() => start()}>{zh ? '开始临时训练' : 'Start temporary workout'} <span aria-hidden="true">→</span></button>
          <ol className="dashboard-workout-steps">
            {[zh ? '选择动作' : 'Choose exercise', zh ? '记录组' : 'Record sets', zh ? '核对完成' : 'Review & finish'].map((step, index) => <li key={step}><span aria-hidden="true">{index + 1}</span>{step}</li>)}
          </ol>
          <p className="dashboard-workout-note">{zh ? '点击“记录组”后才保存实际值。' : 'Actual values save only when you record a set.'}</p>
        </section>
        <section className="dashboard-schedule" aria-label={zh ? '计划日程' : 'Planned schedule'}>{scheduleContent}</section>
      </div> : <>{exerciseChoice}<button disabled={busy} onClick={() => start()}>{zh ? '开始临时训练' : 'Start temporary workout'}</button>{scheduleContent}</>;
    }
    if (session.status !== 'in_progress') return (
      <>
        <WorkoutFacts session={session} sets={sets} locale={locale} />
        <button onClick={() => { setReview(false); void refresh(); }}>{zh ? '开始下一次训练' : 'Start another workout'}</button>
      </>
    );
    if (review) return (
      <CompletionReview session={session} sets={sets} locale={locale} busy={busy}
        onBack={() => setReview(false)}
        onConfirm={() => void run(() => workoutService.completeWorkout(session.id, session.revision), zh ? '训练已完成' : 'Workout completed')} />
    );
    return (
      <>
        <p>{session.localDate} · {session.timeZone} · {session.planVersionId ? (zh ? '计划训练' : 'Planned workout') : (zh ? '临时训练' : 'Temporary workout')}</p>
        {session.exerciseSnapshots.map(exercise => (
          <ExerciseEditor key={exercise.exerciseInstanceId} sessionId={session.id} exercise={exercise}
            sets={sets.filter(set => set.exerciseInstanceId === exercise.exerciseInstanceId)}
            locale={locale} busy={busy}
            onRecordAttempt={() => { setMessage(''); setError(''); }}
            onSave={input => run(() => workoutService.recordSet(session.id, input, session.revision), zh ? '组已保存' : 'Set saved')}
            onAdjust={(command, status) => run(() => workoutService.adjustWorkout(session.id, command, session.revision), status)} />
        ))}
        {exerciseChoice}
        <button disabled={busy} onClick={() => void run(() => workoutService.adjustWorkout(session.id,
          { type: 'add_exercise', exerciseId: choose, exerciseInstanceId: crypto.randomUUID() }, session.revision))}>
          {zh ? '添加动作' : 'Add exercise'}
        </button>
        <div className="workout-actions">
          <button disabled={busy} onClick={() => setReview(true)}>{zh ? '完成前核对' : 'Review completion'}</button>
          <button disabled={busy} onClick={abandon}>{zh ? '放弃训练' : 'Abandon workout'}</button>
          <button disabled={busy} onClick={() => void refresh().catch(reason => setError(reason.message))}>{zh ? '重新载入已保存记录' : 'Reload saved records'}</button>
        </div>
      </>
    );
  }

  return (
    <>
      {!dashboard && <h1>{zh ? '今日训练' : 'Today'}</h1>}
      {(!dashboard || session) && <p className="muted">{zh ? '只有点击记录后，实际值才会保存。' : 'Actual values save when you select Record set.'}</p>}
      {error && <p role="alert">{error}</p>}
      <p role="status">{message}</p>
      <div className={dashboard && session ? 'dashboard-session' : undefined}>{workspace()}</div>
    </>
  );
}
