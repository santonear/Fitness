import { useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { Link, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { database } from '../../persistence/db';
import { repository } from '../../persistence/repository';
import { profileService } from '../../application/profile';
import { dayPlanService, slotTasks } from '../../application/day-plans';
import { guidedService } from '../../application/guided';
import { dateInZone } from '../../application/progress';
import { evaluateSlot } from '../../domain/day-slot-policy';
import { exercises } from '../../catalog/exercises';
import type { LocalProfile, Plan, PlannedExercise, PlanVersion, ScheduledWorkout } from '../../domain/models';
import type { GuidedProgram } from '../../domain/guided-contracts';
import { PlanDatePicker } from '../components/PlanDatePicker';
import { TargetFields } from '../components/PlanEditor';
import { defaultTarget } from '../components/DayPlanEditor';
import { TrainingCalendar } from '../components/guided/TrainingCalendar';
import { formatGuidedTargets } from '../components/guided/ProgramDashboard';
import { ProgramDashboard } from '../components/guided/ProgramDashboard';
import { LifecycleDialog } from '../components/guided/LifecycleDialog';
import { dayPlanFeedback } from '../day-plan-feedback';
import { PlansPage } from './PlansPage';
import { calendarTask, type CalendarTask } from '../calendar-projection';

type Tab = 'calendar' | 'upcoming' | 'create' | 'legacy';
type Snapshot = { profile: LocalProfile; plans: Plan[]; versions: PlanVersion[]; tasks: CalendarTask[]; allTasks: ScheduledWorkout[]; programs: GuidedProgram[]; occupied: string[]; calendarNeedsReview: boolean; generation: number; revision: number; locked: string[] };
type ManualDraft = { name: string; startTime: string; durationMinutes: number; exercises: PlannedExercise[] };
const newDraft = (): ManualDraft => ({ name: '', startTime: '19:00', durationMinutes: 30, exercises: [{ exerciseId: exercises[2].id as PlannedExercise['exerciseId'], order: 0, targetSets: [defaultTarget(exercises[2].id)], setTimings: [{ durationSeconds: 30, restSeconds: 60 }] }] });

export function PlansWorkspace() {
  const { i18n } = useTranslation(); const locale = i18n.resolvedLanguage === 'zh' ? 'zh' : 'en'; const zh = locale === 'zh';
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('calendar');
  const [mode, setMode] = useState<'view' | 'arrange'>('view');
  const [selected, setSelected] = useState<string[]>([]);
  const [detailDate, setDetailDate] = useState('');
  const [snapshot, setSnapshot] = useState<Snapshot>();
  const [error, setError] = useState('');
  const [manual, setManual] = useState(false);
  const [showTimeline, setShowTimeline] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, ManualDraft>>({});
  const [busy, setBusy] = useState(false); const saving = useRef(false);
  const [message, setMessage] = useState('');
  const [saveConfirmed, setSaveConfirmed] = useState(false);
  const draftGeneration = useRef<number | undefined>(undefined);
  useEffect(() => { const target = searchParams.get('tab'); if (target && ['calendar', 'upcoming', 'create', 'legacy'].includes(target)) setTab(target as Tab); const date = searchParams.get('date'); if (date && /^\d{4}-\d{2}-\d{2}$/.test(date) && !Number.isNaN(Date.parse(`${date}T12:00:00Z`))) { setDetailDate(date); setTab('calendar'); } }, [searchParams]);
  useEffect(() => {
    let live = true; let subscription: ReturnType<ReturnType<typeof liveQuery>['subscribe']> | undefined;
    void profileService.initialize(locale).then(() => { if (!live) return;
      subscription = liveQuery(async () => database.transaction('r', database.tables, async () => {
        const profile = await profileService.getProfile(); if (!profile) throw new Error('Profile unavailable');
        const plans = await database.plans.toArray(); const versions = await database.planVersions.toArray(); const rows = await database.scheduledWorkouts.toArray();
        const sessions = await database.sessions.where('status').equals('in_progress').toArray();
        const state = await guidedService.read(); const generation = (await repository.readMetadata()).restoreGeneration ?? 0;
        let calendarNeedsReview = false;
        const slots = await slotTasks(repository, profile.timeZone).catch(async reason => { if ((reason as { code?: string }).code !== 'CALENDAR_PROVENANCE_MISSING') throw reason; calendarNeedsReview = true; return slotTasks(repository, profile.timeZone, []); });
        const tasks = rows.filter(row => !row.hiddenAt && (row.completedSessionId || plans.some(plan => !plan.deletedAt && plan.status === 'active' && plan.currentVersionId === row.planVersionId))).map(row => calendarTask(row, versions, profile.timeZone));
        return { profile, plans, versions, tasks, allTasks: rows, programs: state.programs, generation, revision: state.revision, calendarNeedsReview,
          occupied: [...new Set(slots.filter(task => evaluateSlot([task], task.projectedDate).occupants.length).map(task => task.projectedDate))],
          locked: rows.filter(row => sessions.some(session => session.planVersionId === row.planVersionId && session.plannedDayId === row.plannedDayId)).map(row => row.id) };
      })).subscribe({ next: value => { if (live) { setSnapshot(value); setError(''); } }, error: reason => { if (live) setError(dayPlanFeedback(reason, zh)); } });
    }).catch(reason => { if (live) setError(dayPlanFeedback(reason, zh)); });
    return () => { live = false; subscription?.unsubscribe(); };
  }, []);
  const today = snapshot ? dateInZone(Date.now(), snapshot.profile.timeZone) : dateInZone(Date.now(), 'UTC');
  const shownDate = detailDate || today;
  const details = snapshot?.tasks.filter(task => task.calendarDate === shownDate) ?? [];
  const upcoming = snapshot?.tasks.filter(task => task.calendarDate && task.calendarDate >= today && task.status === 'pending' && !task.completedSessionId).sort((a, b) => `${a.calendarDate}${a.startTime ?? '99'}`.localeCompare(`${b.calendarDate}${b.startTime ?? '99'}`)) ?? [];
  const uncertain = snapshot?.tasks.filter(task => task.calendarDate === null) ?? [];
  const foreign = snapshot?.tasks.filter(task => task.sourceTimeZone !== snapshot.profile.timeZone) ?? [];
  const stopped = snapshot?.tasks.filter(task => snapshot.programs.some(program => program.status !== 'active' && program.taskIds.includes(task.id))) ?? [];
  function changeDates(dates: string[]) { if (busy || snapshot?.calendarNeedsReview) return; setSelected(dates); setSaveConfirmed(false); setMessage(''); setDrafts(values => { const next = { ...values }; for (const date of dates) next[date] ??= newDraft(); return next; }); if (draftGeneration.current === undefined) draftGeneration.current = snapshot?.generation; }
  function updateDraft(date: string, value: ManualDraft) { setDrafts(values => ({ ...values, [date]: value })); setSaveConfirmed(false); setMessage(''); }
  function clearDraft() { setSelected([]); setDrafts({}); setSaveConfirmed(false); draftGeneration.current = snapshot?.generation; }
  async function saveManual() {
    if (!snapshot || snapshot.calendarNeedsReview || saving.current || !saveConfirmed || !selected.length) return;
    saving.current = true; setBusy(true); setError(''); setMessage('');
    try {
      await dayPlanService.saveDayPlans(selected.map(date => ({ ...drafts[date], date, timeZone: snapshot.profile.timeZone, exercises: drafts[date].exercises.map((item, order) => ({ ...item, order })) })), draftGeneration.current ?? snapshot.generation);
      setMessage(zh ? `已保存 ${selected.length} 个独立日计划。` : `Saved ${selected.length} independent day plans.`); clearDraft(); setMode('view'); setTab('upcoming');
    } catch (reason) { setError(dayPlanFeedback(reason, zh)); setSaveConfirmed(false); }
    finally { saving.current = false; setBusy(false); }
  }
  return <div className="v31-plans">
    <header className="v31-page-heading"><div><p className="v31-eyebrow">FITNESS / PLANS</p><h1>{zh ? '训练计划' : 'Training plans'}</h1><p>{zh ? '安排每一天，按自己的节奏训练。' : 'Make room for training, one day at a time.'}</p></div><button type="button" onClick={() => setTab('create')}>{zh ? '＋ 创建计划' : '+ Create plan'}</button></header>
    <div className="v31-plans-tabs" role="tablist" aria-label={zh ? '计划导航' : 'Plan sections'}>{(['calendar', 'upcoming', 'create', 'legacy'] as Tab[]).map((value, index) => <button type="button" role="tab" id={`plans-tab-${value}`} aria-controls={`plans-panel-${value}`} aria-selected={tab === value} tabIndex={tab === value ? 0 : -1} key={value} onClick={() => setTab(value)} onKeyDown={event => { if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') { event.preventDefault(); const next = (index + (event.key === 'ArrowRight' ? 1 : 3)) % 4; const name = (['calendar', 'upcoming', 'create', 'legacy'] as Tab[])[next]; setTab(name); document.getElementById(`plans-tab-${name}`)?.focus(); } }}>{({ calendar: zh ? '日历' : 'Calendar', upcoming: zh ? '即将到来' : 'Upcoming', create: zh ? '创建计划' : 'Create plan', legacy: zh ? '旧计划兼容' : 'Legacy plans' })[value]}</button>)}</div>
    {error && <p className="v31-notice" role="alert">{error}</p>}{message && <p className="v31-notice" role="status">{message}</p>}
    {snapshot?.calendarNeedsReview && <div className="v31-notice" role="alert"><p>{zh ? '部分日程在当前日历时区无法确定日期。新建和保存已暂停，请先复核时区；原始日期与训练历史未改变。' : 'Some schedules have an ambiguous date in this calendar time zone. New selection and saving are paused until the time zone is reviewed. Original dates and history are unchanged.'}</p><Link to="/settings?tab=profile">{zh ? '复核资料时区' : 'Review profile time zone'}</Link></div>}
    {!!uncertain.length && <section className="v31-card" aria-label={zh ? '日期需复核的安排' : 'Schedules needing date review'}><h2>{zh ? '日期需复核' : 'Dates need review'}</h2>{uncertain.map(task => <TaskCard key={task.id} task={task} snapshot={snapshot!} locale={locale} />)}</section>}
    {!snapshot && !error && <p role="status">{zh ? '正在读取本地计划…' : 'Loading your local plans…'}</p>}
    <section role="tabpanel" id="plans-panel-calendar" aria-labelledby="plans-tab-calendar" hidden={tab !== 'calendar'}>
      <div className="v31-calendar-layout"><div className="v31-card"><div className="v31-button-row"><button type="button" aria-pressed={mode === 'view'} onClick={() => setMode('view')}>{zh ? '查看模式' : 'View mode'}</button><button type="button" aria-pressed={mode === 'arrange'} disabled={snapshot?.calendarNeedsReview} onClick={() => setMode('arrange')}>{zh ? '＋ 安排训练' : '+ Arrange training'}</button></div>
        <PlanDatePicker locale={locale} today={today} selected={selected} onChange={changeDates} occupied={snapshot?.occupied ?? []} mode={snapshot?.calendarNeedsReview ? 'view' : mode} onSelectDate={setDetailDate} focusDate={detailDate || undefined} />
        <p className="v31-help">{snapshot?.profile.timeZone}</p></div>
        <aside className="v31-calendar-side v31-card"><span className="v31-eyebrow">{mode === 'view' ? (zh ? '查看模式' : 'VIEW MODE') : (zh ? '安排训练 · 多选' : 'ARRANGE · MULTISELECT')}</span><h2>{shownDate}</h2>
          {!details.length && <p>{snapshot?.occupied.includes(shownDate) ? (zh ? '此日期仍被训练历史占用，不能重复创建。' : 'Training history still occupies this date; it cannot be duplicated.') : (zh ? '这一天没有可见安排。查看不会建立计划。' : 'No visible schedule for this date. Viewing does not create a plan.')}</p>}
          {details.map(task => <TaskCard key={task.id} task={task} snapshot={snapshot!} locale={locale} />)}
          {mode === 'arrange' && <><p role="status">{zh ? '已选择' : 'Selected'} {selected.length} / 14</p><div className="v31-date-chips">{selected.map(date => <span key={date}>{date}</span>)}</div><div className="v31-button-row"><button type="button" onClick={clearDraft}>{zh ? '清空草稿' : 'Clear draft'}</button><button type="button" disabled={!selected.length} onClick={() => { setManual(true); setTab('create'); }}>{zh ? '为这些日期创建计划' : 'Create for these dates'}</button></div></>}
        </aside></div>
      <div className="v31-card v31-time-section"><button type="button" aria-expanded={showTimeline} onClick={() => setShowTimeline(value => !value)}>{zh ? '查看月 / 日时间轴并调整训练时间' : 'View month / day timeline and adjust training time'}</button>
        {showTimeline && snapshot && <>{!!foreign.length && <div className="v31-notice"><p>{zh ? '其他时区的训练按日期投影展示，但不定位到当前时区的小时轴。以下时间仍为来源时区时间；跨时区拖动已禁用，请先复核资料时区。' : 'Training from another time zone is projected by date but is not positioned on this hourly timeline. Times below remain in their source time zone. Cross-zone dragging is disabled; review the profile time zone first.'}</p>{foreign.map(task => <p key={task.id}>{task.scheduledDate} · {task.startTime ?? '—'} · {task.sourceTimeZone ?? (zh ? '来源时区未知' : 'Source time zone unknown')}</p>)}</div>}<TrainingCalendar locale={locale} today={today} tasks={snapshot.tasks.filter(task => task.calendarDate !== null).map(task => ({ ...task, scheduledDate: task.calendarDate!, ...(task.sourceTimeZone !== snapshot.profile.timeZone ? { startTime: undefined, durationMinutes: undefined } : {}) }))} versions={snapshot.versions} timeZone={snapshot.profile.timeZone} revision={snapshot.revision} generation={snapshot.generation} unavailableTaskIds={stopped.map(task => task.id)} ongoingTaskIds={snapshot.locked} lockedTaskIds={[...snapshot.locked, ...foreign.map(task => task.id), ...stopped.map(task => task.id)]} onReschedule={(task, time, revision, generation, duration) => guidedService.rescheduleTime(task.id, time, task.revision, revision, generation, duration)} /></>}</div>
    </section>
    <section role="tabpanel" id="plans-panel-upcoming" aria-labelledby="plans-tab-upcoming" hidden={tab !== 'upcoming'}><div className="v31-card"><h2>{zh ? '即将到来的训练' : 'Your upcoming training'}</h2>{!upcoming.length && <p>{zh ? '还没有即将到来的训练。可以创建手动计划，或与 AI 一起制定。' : 'No upcoming training. Create a manual plan or plan with AI.'}</p>}<div className="v31-upcoming-list">{upcoming.map(task => <TaskCard key={task.id} task={task} snapshot={snapshot!} locale={locale} />)}</div></div></section>
    <section role="tabpanel" id="plans-panel-create" aria-labelledby="plans-tab-create" hidden={tab !== 'create'}>
      <div className="v31-create-choices"><article className="v31-card"><span className="v31-eyebrow">01 / MANUAL</span><h2>{zh ? '手动制定' : 'Build your own'}</h2><p>{zh ? '选择日期、时间和动作。每一天独立编辑，统一确认后保存。无需 AI 额度。' : 'Choose dates, times and exercises. Edit each day independently and save together. No AI allowance needed.'}</p><button type="button" aria-expanded={manual} disabled={snapshot?.calendarNeedsReview} onClick={() => setManual(true)}>{zh ? '开始手动创建' : 'Create manually'}</button></article><article className="v31-card"><span className="v31-eyebrow">02 / WITH AI</span><h2>{zh ? '与 AI 一起制定' : 'Plan with AI'}</h2><p>{zh ? '确认目标 → 选择日期 → 检查发送信息 → 审阅并保存。' : 'Confirm your goal → choose dates → review what is sent → review and save.'}</p><Link className="v31-primary-link" to="/ai" aria-disabled={snapshot?.calendarNeedsReview} onClick={event => { if (snapshot?.calendarNeedsReview) event.preventDefault(); }} state={{ selectedDates: selected }}>{zh ? '进入 AI 计划向导' : 'Open AI plan wizard'}</Link></article></div>
      <div className="v31-card v31-manual" hidden={!manual}><h2>{zh ? '创建独立日计划' : 'Create independent day plans'}</h2><fieldset disabled={busy || snapshot?.calendarNeedsReview}><PlanDatePicker locale={locale} today={today} selected={selected} onChange={changeDates} occupied={snapshot?.occupied ?? []} />
        <form onSubmit={event => { event.preventDefault(); void saveManual(); }}>
          <div className="v31-manual-days">{selected.map(date => drafts[date] && <ManualDay key={date} date={date} value={drafts[date]} onChange={value => updateDraft(date, value)} locale={locale} />)}</div>
          {!!selected.length && <><label className="v31-save-consent"><input type="checkbox" checked={saveConfirmed} onChange={event => setSaveConfirmed(event.target.checked)} />{zh ? `我已核对这 ${selected.length} 天的时间和训练内容，同意保存到当前设备。` : `I reviewed the times and training for these ${selected.length} dates and agree to save them on this device.`}</label><p className="v31-help">{zh ? '遇到日期冲突或资料变化时，整批不会写入，草稿保留。' : 'If dates conflict or data changes, nothing in the batch is written. Your draft is retained.'}</p><button type="submit" disabled={!saveConfirmed || !snapshot || snapshot.calendarNeedsReview || busy}>{busy ? (zh ? '正在保存…' : 'Saving…') : (zh ? '确认保存全部日期' : 'Confirm and save all dates')}</button></>}
        </form></fieldset></div>
    </section>
    <section role="tabpanel" id="plans-panel-legacy" aria-labelledby="plans-tab-legacy" hidden={tab !== 'legacy'}><div className="v31-card"><h2>{zh ? '旧计划与历史安排' : 'Legacy plans and earlier schedules'}</h2><p>{zh ? '旧任务和新日计划各自保留。旧计划操作发生重叠时，仍需逐项检查并确认；这不会允许新日计划覆盖已占用日期。' : 'Legacy tasks and new day plans remain independent. Legacy overlaps still require explicit review; new day plans cannot overwrite occupied dates.'}</p>{snapshot && <RetainedPrograms snapshot={snapshot} locale={locale} />}<PlansPage /></div></section>
  </div>;
}

function RetainedPrograms({ snapshot, locale }: { snapshot: Snapshot; locale: 'zh' | 'en' }) {
  const zh = locale === 'zh';
  const [dialog, setDialog] = useState<{ action: 'pause' | 'resume' | 'cancel'; id: string; revision: number }>();
  const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const lock = useRef(false);
  const open = (program: GuidedProgram, action: 'pause' | 'resume' | 'cancel') => { setError(''); setDialog({ action, id: program.id, revision: snapshot.revision }); };
  if (!snapshot.programs.length) return null;
  return <section className="v31-retained-programs" aria-label={zh ? '保留的训练阶段' : 'Retained training phases'}><h3>{zh ? '保留的训练阶段' : 'Retained training phases'}</h3><p>{zh ? '可以暂停、恢复未到期的原安排，或终止后续安排。历史记录和正在进行的训练保持独立，不会自动补排或延长。' : 'Pause, resume unexpired schedules, or stop future sessions. History and active workouts remain independent. Missed dates are not filled and the end date is not extended.'}</p>
    {snapshot.programs.map(program => {
      const tasks = snapshot.allTasks.filter(task => program.taskIds.includes(task.id));
      const today = dateInZone(Date.now(), program.timeZone);
      const dayNumber = (date: string) => Date.parse(`${date}T12:00:00Z`) / 86_400_000;
      const totalDays = dayNumber(program.endDate) - dayNumber(program.startDate) + 1;
      return <ProgramDashboard key={program.id} locale={locale} title={program.name} status={program.status === 'terminated' ? 'cancelled' : program.status} startDate={program.startDate} endDate={program.endDate} totalDays={totalDays} elapsedDays={Math.min(totalDays, Math.max(0, dayNumber(today) - dayNumber(program.startDate) + 1))} plannedWorkouts={tasks.length} completedWorkouts={tasks.filter(task => task.completedSessionId).length} rationale={program.explanation}
        todayLabel={tasks.some(task => snapshot.locked.includes(task.id)) ? (zh ? '进行中的训练继续保留，可以从今日页面继续记录。' : 'Your active workout is retained. Continue recording from Today.') : program.status === 'active' && tasks.some(task => task.scheduledDate === today && task.status === 'pending' && !task.hiddenAt && !task.completedSessionId) ? (zh ? '今天有训练安排，可在日历中查看。' : 'Training is scheduled today; view it in the calendar.') : (zh ? '原安排及其历史保留在当前设备。' : 'The original schedule and its history remain on this device.')}
        onPause={() => open(program, 'pause')} onResume={() => open(program, 'resume')} onCancel={() => open(program, 'cancel')} busy={busy} />;
    })}
    {dialog && <LifecycleDialog open locale={locale} action={dialog.action} busy={busy} error={error} onClose={() => { setDialog(undefined); setError(''); }} onConfirm={reason => {
      if (lock.current) return; lock.current = true; setBusy(true); setError('');
      void guidedService.transition(dialog.id, dialog.action === 'pause' ? 'paused' : dialog.action === 'resume' ? 'active' : 'terminated', dialog.revision, reason)
        .then(() => setDialog(undefined)).catch(() => setError(zh ? '未能修改：安排、资料或日期可能已变化。请返回后重新检查。原计划未被覆盖。' : 'Could not change this phase. The schedule, data or dates may have changed. Go back and review; the original plan was not overwritten.'))
        .finally(() => { lock.current = false; setBusy(false); });
    }} />}
  </section>;
}

function TaskCard({ task, snapshot, locale }: { task: CalendarTask; snapshot: Snapshot; locale: 'zh' | 'en' }) {
  const zh = locale === 'zh'; const version = snapshot.versions.find(value => value.id === task.planVersionId); const plan = snapshot.plans.find(value => value.id === version?.planId); const day = version?.days.find(value => value.dayId === task.plannedDayId);
  const phase = snapshot.programs.find(program => program.taskIds.includes(task.id)); const stopped = phase && phase.status !== 'active'; const ongoing = snapshot.locked.includes(task.id);
  return <article className="v31-task-card"><div><p className="v31-task-date">{task.calendarDate ?? (zh ? '日期需复核' : 'Date needs review')} · {task.startTime ?? (zh ? '未设时间' : 'Flexible time')}{task.durationMinutes ? ` · ${task.durationMinutes} ${zh ? '分钟' : 'min'}` : ''}</p><h3>{plan?.name}</h3>{stopped && <p className="v31-help">{phase.status === 'paused' ? (zh ? '阶段已暂停；恢复后可开始训练。' : 'Phase paused; resume before starting training.') : (zh ? '阶段已终止；已有训练记录保留。' : 'Phase terminated; existing training records are retained.')}</p>}<p className="v31-help">{task.completedSessionId ? (zh ? '已完成' : 'Completed') : task.status === 'skipped' ? (zh ? '已跳过，历史保留' : 'Skipped; history retained') : (zh ? '待训练' : 'Scheduled')}</p>{task.sourceTimeZone !== snapshot.profile.timeZone && <p className="v31-help">{zh ? '来源日期 / 时区' : 'Source date / time zone'}: {task.scheduledDate} · {task.sourceTimeZone ?? (zh ? '未知' : 'Unknown')}</p>}</div><details><summary>{zh ? '训练内容' : 'Training details'}</summary>{day?.exercises.map(item => <div key={`${item.order}-${item.exerciseId}`}><h4>{exercises.find(value => value.id === item.exerciseId)?.name[locale]}</h4><ul>{formatGuidedTargets(item.targetSets, locale, item.setTimings).map((target, index) => <li key={index}>{target}</li>)}</ul>{item.notes && <p>{item.notes}</p>}</div>)}</details>{task.status === 'pending' && !task.completedSessionId && task.calendarDate !== null && (!stopped || ongoing) && <Link to={ongoing ? '/workout' : `/workout?scheduledWorkoutId=${encodeURIComponent(task.id)}`}>{snapshot.locked.includes(task.id) ? (zh ? '继续训练' : 'Continue workout') : (zh ? '开始训练' : 'Start workout')}</Link>}{task.completedSessionId && <Link to="/progress">{zh ? '查看训练历史' : 'View training history'}</Link>}</article>;
}

function ManualDay({ date, value, onChange, locale }: { date: string; value: ManualDraft; onChange: (value: ManualDraft) => void; locale: 'zh' | 'en' }) {
  const zh = locale === 'zh';
  function update(index: number, item: PlannedExercise) { onChange({ ...value, exercises: value.exercises.map((old, i) => i === index ? item : old) }); }
  return <fieldset className="v31-manual-day"><legend>{date}</legend><div className="v31-manual-fields"><label>{zh ? '计划名称' : 'Plan name'}<input required maxLength={160} value={value.name} onChange={event => onChange({ ...value, name: event.target.value })} /></label><label>{zh ? '开始时间' : 'Start time'}<input required type="time" value={value.startTime} onChange={event => onChange({ ...value, startTime: event.target.value })} /></label><label>{zh ? '训练时长（分钟）' : 'Duration (minutes)'}<input required type="number" min="1" max="1440" value={value.durationMinutes} onChange={event => onChange({ ...value, durationMinutes: Number(event.target.value) })} /></label></div>
    {value.exercises.map((item, index) => <fieldset className="v31-manual-exercise" key={index}><legend>{zh ? '动作' : 'Exercise'} {index + 1}</legend><label>{zh ? '选择动作' : 'Choose exercise'}<select value={item.exerciseId} onChange={event => { const target = defaultTarget(event.target.value); update(index, { exerciseId: event.target.value as PlannedExercise['exerciseId'], order: index, targetSets: [target], setTimings: [{ durationSeconds: 'durationSeconds' in target ? target.durationSeconds : 30, restSeconds: 60 }] }); }}>{exercises.map(exercise => <option key={exercise.id} value={exercise.id}>{exercise.name[locale]}</option>)}</select></label>
      {item.targetSets.map((target, setIndex) => <div className="v31-manual-set" key={`${setIndex}-${target.metricType}`}><strong>{zh ? '第' : 'Set'} {setIndex + 1} {zh ? '组' : ''}</strong><TargetFields target={target} zh={zh} onChange={next => update(index, { ...item, targetSets: item.targetSets.map((old, i) => i === setIndex ? next : old), setTimings: item.setTimings?.map((timing, i) => i === setIndex && 'durationSeconds' in next ? { ...timing, durationSeconds: next.durationSeconds } : timing) })} />
        {!('durationSeconds' in target) && <label>{zh ? '预计本组时长（秒）' : 'Estimated set duration (seconds)'}<input type="number" required min="1" max="86400" value={item.setTimings?.[setIndex].durationSeconds ?? 30} onChange={event => update(index, { ...item, setTimings: item.setTimings?.map((timing, i) => i === setIndex ? { ...timing, durationSeconds: Number(event.target.value) } : timing) })} /></label>}
        <label>{zh ? '组后休息（秒）' : 'Rest after set (seconds)'}<input type="number" required min="0" max="86400" value={item.setTimings?.[setIndex].restSeconds ?? 60} onChange={event => update(index, { ...item, setTimings: item.setTimings?.map((timing, i) => i === setIndex ? { ...timing, restSeconds: Number(event.target.value) } : timing) })} /></label>
        <button type="button" disabled={item.targetSets.length < 2} onClick={() => update(index, { ...item, targetSets: item.targetSets.filter((_, i) => i !== setIndex), setTimings: item.setTimings?.filter((_, i) => i !== setIndex) })}>{zh ? '删除此组' : 'Remove set'}</button></div>)}
      <div className="v31-button-row"><button type="button" onClick={() => { const target = defaultTarget(item.exerciseId); update(index, { ...item, targetSets: [...item.targetSets, target], setTimings: [...(item.setTimings ?? []), { durationSeconds: 'durationSeconds' in target ? target.durationSeconds : 30, restSeconds: 60 }] }); }}>{zh ? '＋ 添加一组' : '+ Add set'}</button><button type="button" disabled={value.exercises.length < 2} onClick={() => onChange({ ...value, exercises: value.exercises.filter((_, i) => i !== index) })}>{zh ? '移除动作' : 'Remove exercise'}</button></div><label>{zh ? '动作备注（可选）' : 'Exercise notes (optional)'}<textarea value={item.notes ?? ''} onChange={event => update(index, { ...item, notes: event.target.value })} /></label></fieldset>)}
    <button type="button" onClick={() => onChange({ ...value, exercises: [...value.exercises, ...newDraft().exercises.map(item => ({ ...item, order: value.exercises.length }))] })}>{zh ? '＋ 添加动作' : '+ Add exercise'}</button>
  </fieldset>;
}
