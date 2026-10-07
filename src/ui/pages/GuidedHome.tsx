import { useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { database } from '../../persistence/db';
import { profileService } from '../../application/profile';
import { guidedService } from '../../application/guided';
import { bodyWeightService } from '../../application/body-weight';
import { dateInZone } from '../../application/progress';
import { emptyGuidedState, type GuidedState } from '../../domain/guided-contracts';
import { GuidedOnboarding, ProgramDashboard, LifecycleDialog, GuidedTimeline, GuidedMeasurements, formatGuidedTargets, type GuidedExerciseView } from '../components/guided';
import { exercises as exerciseCatalog } from '../../catalog/exercises';
import { WorkoutPage } from './WorkoutPage';
import { TrialAccess } from '../components/TrialAccess';
import { TrainingCalendar } from '../components/guided/TrainingCalendar';
import { TrainingAnalytics } from '../components/guided/TrainingAnalytics';
import type { Plan, PlanVersion, WorkoutSession, ScheduledWorkout, BodyWeightObservation } from '../../domain/models';

export function GuidedHome({ panelOnly = false }: { panelOnly?: boolean }) {
  const { i18n } = useTranslation(); const locale = i18n.resolvedLanguage === 'zh' ? 'zh' : 'en'; const zh = locale === 'zh'; const navigate = useNavigate();
  const [state, setState] = useState<GuidedState>(emptyGuidedState); const reference = useRef(state); const queue = useRef(Promise.resolve());
  const [rows, setRows] = useState<ScheduledWorkout[]>([]);
  const [legacy, setLegacy] = useState<Plan[]>([]);
  const [weights, setWeights] = useState<BodyWeightObservation[]>([]);
  const [versions, setVersions] = useState<PlanVersion[]>([]);
  const [activeSession, setActiveSession] = useState<WorkoutSession>();
  const [loaded, setLoaded] = useState(false);
  const [trialReady, setTrialReady] = useState(import.meta.env.DEV && import.meta.env.VITE_GUIDED_DEMO === '1');
  const [ongoing, setOngoing] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [panel, setPanel] = useState(panelOnly); const [revisit, setRevisit] = useState(false); const [online, setOnline] = useState(navigator.onLine);
  const [dialog, setDialog] = useState<{ action: 'pause' | 'cancel' | 'resume'; id: string; revision: number; legacy: boolean }>();
  useEffect(() => {
    let alive = true; let unsubscribe = () => {};
    void profileService.initialize(locale).then(() => {
      if (!alive) return;
      const subscription = liveQuery(async () => ({ state: await guidedService.read(), rows: await database.scheduledWorkouts.toArray(), legacy: await database.plans.toArray(), weights: await database.bodyWeights.toArray(), versions: await database.planVersions.toArray(), session: await database.sessions.where('status').equals('in_progress').first() })).subscribe({
        next: result => { setState(result.state); reference.current = result.state; setRows(result.rows); setLegacy(result.legacy); setWeights(result.weights); setVersions(result.versions); setActiveSession(result.session); setOngoing(Boolean(result.session)); setLoaded(true); },
        error: reason => setError(String(reason)),
      }); unsubscribe = () => subscription.unsubscribe();
    }).catch(reason => setError(String(reason)));
    const connected = () => setOnline(navigator.onLine); window.addEventListener('online', connected); window.addEventListener('offline', connected);
    return () => { alive = false; unsubscribe(); window.removeEventListener('online', connected); window.removeEventListener('offline', connected); };
  }, [locale]);
  function run(operation: (revision: number) => Promise<unknown>) {
    const completion = queue.current.then(async () => {
      setBusy(true); setError('');
      try { await operation(reference.current.revision); const next = await guidedService.read(); reference.current = next; setState(next); }
      catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); throw reason; }
      finally { setBusy(false); }
    });
    queue.current = completion.catch(() => {});
    return completion;
  }
  const program = state.programs.find(item => item.status !== 'terminated');
  const old = legacy.find(item => item.status === 'active' && !item.deletedAt && !state.programs.some(program => program.planIds.includes(item.id)));
  const current = program ?? (old ? { id: old.id, name: old.name, status: 'active' as const, startDate: old.startDate, endDate: rows.filter(item => legacy.find(plan => plan.id === old.id)?.currentVersionId === item.planVersionId).map(item => item.originalDate).sort().at(-1) ?? old.startDate, timeZone: old.scheduleTimeZone, explanation: '', taskIds: rows.filter(item => item.planVersionId === old.currentVersionId).map(item => item.id) } : undefined);
  const today = dateInZone(Date.now(), current?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone);
  const tasks = rows.filter(item => current?.taskIds.includes(item.id));
  const stateLabel = (value?: string) => !value ? '—' : zh ? (({ active: '执行中', paused: '暂停', terminated: '终止', running: '进行中', in_progress: '进行中', completed: '已完成', abandoned: '已放弃' } as Record<string,string>)[value] ?? value) : value.replaceAll('_', ' ');
  const dayNumber = (value: string) => Date.parse(`${value}T00:00:00Z`) / 86_400_000;
  const showOnboarding = !panel && !current && !ongoing && (!state.onboarding?.completed || revisit);
  const open = (action: 'pause' | 'cancel' | 'resume') => { if (current) setDialog({ action, id: current.id, revision: state.revision, legacy: !program }); };
  const invitation = online ? state.invitations.find(item => item.decision === 'pending') : undefined;
  const plannedToday = current?.status === 'active' ? tasks.filter(item => item.scheduledDate === today && !item.completedSessionId && !item.hiddenAt && item.status === 'pending').flatMap(task => {
    const day = versions.find(version => version.id === task.planVersionId)?.days.find(day => day.dayId === task.plannedDayId);
    return (day?.exercises ?? []).map(exercise => ({ ...exercise, displayId: `${task.id}-${exercise.order}` }));
  }) : [];
  const todayExercises: GuidedExerciseView[] = (activeSession ? activeSession.exerciseSnapshots.map(exercise => ({ ...exercise, displayId: exercise.exerciseInstanceId })) : plannedToday).map(exercise => {
    const catalog = exerciseCatalog.find(item => item.id === exercise.exerciseId);
    const snapshot = activeSession?.exerciseSnapshots.find(item => item.exerciseInstanceId === exercise.displayId);
    const targets = formatGuidedTargets(exercise.targetSets, locale);
    if (snapshot?.originalExerciseId) targets.unshift(zh ? '替换动作沿用原动作目标，仅作参考。' : 'replacement targets refer to the original exercise and are for reference only.');
    return { id: exercise.displayId, name: snapshot?.name[locale] ?? catalog?.name[locale] ?? exercise.exerciseId, targets, safety: catalog?.cautions[locale].join(' ') || (zh ? '该动作暂无已核对的安全提醒。' : 'no reviewed safety guidance is available for this exercise.'), steps: catalog?.steps[locale], reason: exercise.notes };
  });
  function pauseNow() {
    if (!current || busy) return;
    void run(async revision => {
      if (program) await guidedService.transition(current.id, 'paused', revision);
      else await guidedService.transitionLegacy(current.id, 'paused', revision);
      navigate('/ai');
    }).catch(() => {});
  }
  if (!loaded) return <div className="guided-page"><p role={error ? 'alert' : 'status'}>{error || (zh ? '正在读取本地计划与训练…' : 'loading local plans and workouts…')}</p></div>;
  if (showOnboarding && !trialReady) return <TrialAccess onContinue={() => setTrialReady(true)} onSkip={() => setPanel(true)} />;
  return <div className={`guided-page${showOnboarding ? ' guided-welcome' : ' guided-records'}`}>
    {(showOnboarding || panelOnly) && <h1>{showOnboarding ? (zh ? '从了解你开始。' : 'let’s start with you.') : (zh ? '训练计划' : 'training plans')}</h1>}
    {showOnboarding && <p className="guided-welcome-intro">{zh ? '一步一步，找到适合你生活的训练。' : 'one step at a time. training that fits your life.'}</p>}
    {error && !showOnboarding && <p role="alert">{error}</p>}
    {showOnboarding ? <>
      <GuidedOnboarding locale={locale} step={state.onboarding?.step ?? 0} answers={state.onboarding?.answers ?? {}} busy={busy} error={error}
        onAnswer={(key, answer) => run(revision => guidedService.saveAnswer(key, answer, reference.current.onboarding?.step ?? 0, revision))}
        onStepChange={step => { void run(revision => guidedService.setStep(step, revision)).catch(() => {}); }}
        onReset={() => { void run(revision => guidedService.resetOnboarding(revision)).catch(() => {}); }}
        onComplete={() => { void run(async revision => { await guidedService.completeOnboarding(revision); navigate('/ai'); }).catch(() => {}); }} />
      <button className="guided-dashboard-link" onClick={() => setPanel(true)}>{zh ? '先查看记录面板' : 'view your dashboard first'}</button>
    </> : <>
      {!panelOnly && <TrainingAnalytics locale={locale} today={today} timeZone={current?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone} />}
      <ProgramDashboard locale={locale} title={current?.name ?? (zh ? '开始制定适合你的计划' : 'start a plan that fits you')} status={current?.status === 'terminated' ? 'cancelled' : current?.status ?? 'none'}
        startDate={current?.startDate} endDate={current?.endDate} elapsedDays={current ? Math.max(0, Math.min(dayNumber(current.endDate) - dayNumber(current.startDate) + 1, dayNumber(today) - dayNumber(current.startDate) + 1)) : 0}
        totalDays={current ? dayNumber(current.endDate) - dayNumber(current.startDate) + 1 : 0} completedWorkouts={tasks.filter(item => item.completedSessionId).length} plannedWorkouts={tasks.length}
        todayLabel={ongoing ? (zh ? '你有正在进行的训练，网络或 AI 故障不会中断记录。' : 'your active workout stays available without AI.') : tasks.some(item => item.scheduledDate === today && !item.completedSessionId && !item.hiddenAt && item.status === 'pending') && current?.status === 'active' ? (zh ? '今天有训练安排' : 'training is scheduled today') : (zh ? '按自己的节奏继续' : 'continue at your own pace')}
        rationale={current?.explanation} exercises={todayExercises} actionLabel={ongoing ? (zh ? '继续训练' : 'continue workout') : current ? (zh ? '查看训练' : 'view workout') : (zh ? '继续制定计划' : 'continue planning')}
        onToday={() => navigate(ongoing || current ? '/workout' : '/ai')} onDialogue={() => navigate('/ai')} onPause={pauseNow} onResume={() => open('resume')} onCancel={() => open('cancel')} busy={busy} />
      {!current && <button onClick={() => { setPanel(false); setRevisit(true); }}>{zh ? '继续欢迎引导' : 'continue onboarding'}</button>}
      {current && <p>{zh ? '未完成' : 'not completed'}: {tasks.filter(item => !item.completedSessionId).length} · {zh ? '已到期未完成' : 'due and not completed'}: {tasks.filter(item => item.originalDate <= today && !item.completedSessionId).length}</p>}
      {ongoing && !panelOnly && <WorkoutPage dashboard />}
    </>}
    {invitation && <section className="guided-section" aria-label={zh ? '恢复连接后的邀请' : 'reconnection invitation'}><p>{zh ? '我注意到你刚才暂停或停止了安排。愿意一起看看是否需要调整吗？' : 'you paused or stopped an arrangement. would you like to discuss a change?'}</p>
      <p>{zh ? '需要你确认后才发送信息；连接恢复不代表 AI 一定可用。' : 'nothing is sent without confirmation; connectivity does not guarantee AI availability.'}</p>
      {(['accepted', 'later', 'declined'] as const).map((decision, index) => <button key={decision} disabled={busy} onClick={() => { void run(async revision => { await guidedService.decideInvitation(invitation.id, decision, revision); if (decision === 'accepted') navigate('/ai'); }).catch(() => {}); }}>{(zh ? ['聊一聊', '稍后', '不用了'] : ['talk', 'later', 'no thanks'])[index]}</button>)}
    </section>}
    {dialog && <LifecycleDialog locale={locale} open action={dialog.action} busy={busy} error={error} onClose={() => setDialog(undefined)} onConfirm={reason => { void run(async () => {
      const action = dialog.action === 'pause' ? 'paused' : dialog.action === 'cancel' ? 'terminated' : 'active';
      if (dialog.legacy) await guidedService.transitionLegacy(dialog.id, action, dialog.revision, reason); else await guidedService.transition(dialog.id, action, dialog.revision, reason);
      setDialog(undefined); if (action !== 'active') navigate('/ai');
    }).catch(() => {}); }} />}
    {!showOnboarding && <>
      <TrainingCalendar locale={locale} today={today} tasks={tasks} versions={versions} timeZone={current?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone} />
      <GuidedMeasurements locale={locale} busy={busy} observations={[...weights.map(item => ({ id: item.id, kind: 'weight' as const, value: item.weightGrams / 1000, date: item.localDate, method: zh ? '用户记录' : 'user recorded' })), ...state.observations.map(item => ({ id: item.id, kind: item.kind, value: item.value, date: item.localDate, method: item.method }))]}
        onSave={async input => { setError(''); try { const profile = (await profileService.getProfile())!;
          if (input.kind === 'weight') await bodyWeightService.saveBodyWeight({ weightGrams: Math.round(input.value * 1000), localDate: input.date, timeZone: profile.timeZone });
          else await guidedService.saveObservation({ id: crypto.randomUUID(), kind: input.kind, value: input.value, unit: input.kind === 'waist' ? 'cm' : '%', localDate: input.date, timeZone: profile.timeZone, method: input.method, createdAt: new Date().toISOString() }, state.revision);
        } catch (reason) { setError(String(reason)); throw reason; } }} />
      <GuidedTimeline locale={locale} entries={state.events.map(item => ({ id: item.id, date: item.createdAt, title: ({ created: zh ? '新计划已生效' : 'new plan active', paused: zh ? '计划暂停' : 'plan paused', resumed: zh ? '计划恢复' : 'plan resumed', terminated: zh ? '计划终止' : 'plan stopped', replaced: zh ? '旧计划存档' : 'old plan archived', workout_paused: zh ? '训练暂停' : 'workout paused', workout_resumed: zh ? '训练恢复' : 'workout resumed', workout_ended: zh ? '训练结束' : 'workout ended' })[item.action], detail: item.reason, result: `${stateLabel(item.before)} → ${stateLabel(item.after)}` }))} />
      <Link to="/progress">{zh ? '查看完整训练历史' : 'view training history'}</Link>
    </>}
  </div>;
}
