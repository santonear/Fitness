import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { workoutService } from '../../application/workouts';
import { profileService } from '../../application/profile';
import { exercises } from '../../catalog/exercises';
import type { WorkoutSession, SetRecord, Locale, ScheduledWorkout } from '../../domain/models';
import { CompletionReview, WorkoutFacts } from '../components/CompletionReview';
import { ExerciseEditor } from '../components/ExerciseEditor';

export function WorkoutPage() {
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
  const locked = useRef(false);

  async function refresh() {
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
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const now = new Date();
    const localDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    void run(() => workoutService.startWorkout({ sessionId: crypto.randomUUID(), localDate, timeZone,
      ...(scheduledWorkoutId ? { scheduledWorkoutId } : { exerciseIds: [choose] }) }));
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
    if (!session) return (
      <>
        {exerciseChoice}
        <button disabled={busy} onClick={() => start()}>{zh ? '开始临时训练' : 'Start temporary workout'}</button>
        <h2>{zh ? '计划日程' : 'Planned schedule'}</h2>
        {schedule.filter(row => !requested || row.id === requested).map(row => (
          <div key={row.id}>
            {row.originalDate} → {row.scheduledDate}
            <button disabled={busy} onClick={() => start(row.id)}>{zh ? '开始计划训练' : 'Start planned workout'}</button>
          </div>
        ))}
      </>
    );
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
          <ExerciseEditor key={exercise.exerciseInstanceId} exercise={exercise}
            sets={sets.filter(set => set.exerciseInstanceId === exercise.exerciseInstanceId)}
            sessionRevision={session.revision} locale={locale} busy={busy}
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
      <h1>{zh ? '今日训练' : 'Today'}</h1>
      <p className="muted">{zh ? '只有点击记录后，实际值才会保存。' : 'Actual values save when you select Record set.'}</p>
      {error && <p role="alert">{error}</p>}
      <p role="status">{message}</p>
      {workspace()}
    </>
  );
}
