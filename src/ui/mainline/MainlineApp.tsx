import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ThemeProvider, useTheme } from '../../themes/ThemeProvider';
import { getThemeSlots, themes } from '../../themes/registry';
import { Button, Sheet, Stat } from '../components/common';
import { OnboardingPage, type OnboardingAnswers } from '../pages/onboarding/OnboardingPage';
import { PlanDraftPage } from '../pages/onboarding/PlanDraftPage';
import { createV8Workflow, type LocalCandidate } from '../../application/v8-workflow';
import { profileService } from '../../application/profile';
import { repository } from '../../persistence/repository';
import { createV8DataService } from '../../persistence/v8-access';
import { computeWeekFacts } from '../../application/review/compute';
import { exercises } from '../../catalog/exercises';
import { localProfile as profile } from '../../application/rules/local-profile';
import type { Feedback } from '../../domain/v8/contracts';
import type { WeekFacts } from '../../application/review/contracts';
import '../theme.css';
import './mainline.css';

const workflow = createV8Workflow(repository);
type Snapshot = Awaited<ReturnType<typeof workflow.snapshot>>;
const blank: OnboardingAnswers = { goalText: '', scheduleOriginalText: '', placeEquipmentText: '', adultConfirmed: false, cautions: [] };
const reasons = ['time', 'fatigue', 'discomfort', 'equipment_busy', 'not_today', 'other'] as const;
function week(timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
  const date = new Date(`${['year', 'month', 'day'].map(type => parts.find(part => part.type === type)!.value).join('-')}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7); const from = date.toISOString().slice(0, 10);
  date.setUTCDate(date.getUTCDate() + 6); return { from, to: date.toISOString().slice(0, 10) };
}
function Mainline() {
  const navigate = useNavigate(), location = useLocation(), { theme, change } = useTheme(), slots = getThemeSlots(theme);
  const [data, setData] = useState<Snapshot>(), [answers, setAnswers] = useState<OnboardingAnswers>(blank), [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [candidate, setCandidate] = useState<LocalCandidate>(), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [facts, setFacts] = useState<WeekFacts>(), [feedback, setFeedback] = useState<Feedback>({ reasons: [] });
  const [manualId, setManualId] = useState(exercises[0].id), [paused, setPaused] = useState(false);
  const [values, setValues] = useState<Record<string, number>>({}), [elapsed, setElapsed] = useState(0);
  const draftKey = useRef(''), initialized = useRef(false), busyRef = useRef(false);
  const zh = data?.profile?.locale !== 'en', locale = zh ? 'zh' : 'en';
  const tr = (cn: string, en: string) => zh ? cn : en;
  async function reload() {
    const next = await workflow.snapshot(); setData(next);
    const review = await createV8DataService(repository).getReviewWorkouts();
    setFacts(computeWeekFacts({ ...week(next.profile?.timeZone ?? 'Asia/Shanghai'), timeZone: next.profile?.timeZone ?? 'Asia/Shanghai',
      weeklyTarget: next.version?.weeklyTarget ?? 2, ...review, activities: await repository.db.v8Activities.toArray(), bodyWeights: await repository.db.bodyWeights.toArray() }));
    return next;
  }
  async function run(action: () => Promise<void>) {
    if (busyRef.current) return; busyRef.current = true; setBusy(true); setError('');
    try { await action(); await reload(); } catch { setError(tr('操作未完成。请检查输入；已保存的记录不会被覆盖。', 'Could not finish. Check your input; saved records have not been replaced.')); }
    finally { busyRef.current = false; setBusy(false); }
  }
  useEffect(() => { let alive = true; void (async () => {
    await profileService.initialize('zh'); const next = await reload(); if (!alive) return;
    draftKey.current = `fitness-v8-draft:${next.metadata.localProfileId}:${next.metadata.restoreGeneration ?? 0}`;
    try { const saved = JSON.parse(localStorage.getItem(draftKey.current) ?? 'null'); if (saved?.answers) { setAnswers(saved.answers); setStep(saved.step ?? 0); } } catch { /* Unknown local draft does not alter database facts. */ }
    initialized.current = true;
    const legacy = await repository.db.guidedStates.get('guided');
    if (location.pathname === '/' && !next.version && !next.active && !legacy?.onboarding?.completed && await repository.db.sessions.count() === 0) navigate('/onboarding', { replace: true });
  })().catch(() => { if (alive) setError('无法读取本地资料 / Cannot read local data'); }); return () => { alive = false; }; }, []);
  useEffect(() => { if (initialized.current) try { localStorage.setItem(draftKey.current, JSON.stringify({ answers, step })); } catch { setError(tr('无法保存引导进度。', 'Could not save onboarding progress.')); } }, [answers, step]);
  useEffect(() => { const last = data?.active?.sets.at(-1)?.completedAt; if (!last) { setElapsed(0); return; }
    const update = () => setElapsed(Math.max(0, Math.floor((Date.now() - Date.parse(last)) / 1000))); update(); const timer = window.setInterval(update, 1000); return () => clearInterval(timer);
  }, [data?.active?.sets.length]);
  const active = data?.active, path = location.pathname;
  const training = path.startsWith('/workout/') && !path.endsWith('/finish');
  const name = (id: string) => exercises.find(item => item.id === id)?.name[locale] ?? id;
  const start = (templateId?: string) => run(async () => { const record = await workflow.start(templateId, templateId ? undefined : manualId); setFeedback({ reasons: [] }); setValues({}); setPaused(false); navigate(`/workout/${record.id}`); });
  if (!data) return <main className="v8-shell"><p role="status">{error || '正在读取本地资料 / Loading local data'}</p></main>;
  let page;
  if (path === '/onboarding') page = <OnboardingPage locale={locale} answers={answers} step={step} slots={slots} mode="basic" busy={busy} error={error}
    onChange={next => { setAnswers(next); setCandidate(undefined); }} onStep={setStep} onManual={() => navigate('/manual')}
    onGenerate={() => void run(async () => { if (answers.cautions.length) { setError(tr('已选择需要注意的部位，请使用手动训练。', 'Use manual training for the selected limitations.')); return; } setCandidate(await workflow.propose(profile(answers))); navigate('/plan-draft'); })} />;
  else if (path === '/plan-draft' && candidate) page = <PlanDraftPage locale={locale} candidate={candidate} basic slots={slots} busy={busy} error={error}
    exerciseText={id => ({ name: name(id), instructions: exercises.find(item => item.id === id)?.steps[locale].join(' ') ?? '' })}
    onDiscuss={() => navigate('/onboarding')} onConfirm={() => void run(async () => { await workflow.adopt(candidate); setCandidate(undefined); navigate('/'); })} />;
  else if (path.endsWith('/finish') && active) page = <main><h1>{tr('结束并记下', 'Finish and record')}</h1><p>{active.sets.length} / {active.plannedSetCount} {tr('组已完成', 'sets complete')}</p>
    <fieldset><legend>{tr('这次感觉怎么样？', 'How did it feel?')}</legend>{(['easy', 'right', 'tired', 'very_tired'] as const).map((feel, index) => <label key={feel}><input type="radio" name="feel" checked={feedback.feel === feel} onChange={() => setFeedback({ ...feedback, feel })} />{(zh ? ['轻松', '刚好', '有点累', '很累'] : ['Easy', 'Right', 'Tired', 'Very tired'])[index]}</label>)}</fieldset>
    <fieldset><legend>{tr('想记下的原因（可选）', 'Reasons (optional)')}</legend>{reasons.map((reason, index) => <label key={reason}><input type="checkbox" checked={feedback.reasons.includes(reason)} onChange={e => setFeedback({ ...feedback, reasons: e.target.checked ? [...feedback.reasons, reason] : feedback.reasons.filter(value => value !== reason) })} />{(zh ? ['时间不够', '疲劳', '哪里不舒服', '器械被占用', '今天不想练', '其他'] : ['Time', 'Fatigue', 'Discomfort', 'Equipment busy', 'Not today', 'Other'])[index]}</label>)}</fieldset>
    {feedback.reasons.includes('discomfort') && <fieldset><legend>{tr('哪些动作（可选）', 'Which exercises (optional)')}</legend>{[...new Set(active.sets.map(set => set.exerciseId))].map(id => <label key={id}><input type="checkbox" checked={feedback.discomfortExerciseIds?.includes(id) ?? false} onChange={e => setFeedback({ ...feedback, discomfortExerciseIds: e.target.checked ? [...feedback.discomfortExerciseIds ?? [], id] : feedback.discomfortExerciseIds?.filter(value => value !== id) })} />{name(id)}</label>)}</fieldset>}
    <label>{tr('备注（可选）', 'Note (optional)')}<textarea value={feedback.note ?? ''} onChange={e => setFeedback({ ...feedback, note: e.target.value })} /></label>
    <Button variant="primary" disabled={busy} onClick={() => void run(async () => { await workflow.finish(active.id, feedback); navigate('/review'); })}>{active.sets.length ? tr('记下这次', 'Save this workout') : tr('记下这次（0 组）', 'Save this workout (0 sets)')}</Button>
    {active.sets.length === 0 && <Button disabled={busy} onClick={() => void run(async () => { await workflow.finish(active.id, feedback, true); navigate('/'); })}>{tr('放弃这次', 'Abandon workout')}</Button>}</main>;
  else if (training && active) page = <main data-training-active="true"><h1>{tr('训练中', 'Training')}</h1><p>{active.sets.length} / {active.plannedSetCount}</p>
    {active.plannedExercises?.map(item => { const exercise = exercises.find(row => row.id === item.exerciseId)!; return <Sheet key={item.itemIndex}><h2>{exercise.name[locale]}</h2><p>{exercise.steps[locale].join(' ')}</p>
      {Array.from({ length: item.plannedSetCount }, (_, setIndex) => { const key = `${item.itemIndex}:${setIndex}`, done = active.sets.find(set => set.itemIndex === item.itemIndex && set.setIndex === setIndex);
        const target = data.version?.templates.find(t => t.id === active.templateId)?.items[item.itemIndex]?.target;
        const timed = exercise.metricType.startsWith('duration'), value = values[key] ?? (target && ('reps' in target ? target.reps : target.durationSeconds)) ?? (timed ? 20 : 8);
        return <div className="v8-training-set" key={key}><label>{tr('第', 'Set ')}{setIndex + 1}{tr('组', '')} · {timed ? tr('秒', 'seconds') : tr('次数', 'reps')}<input type="number" min="1" value={done ? done.reps ?? done.durationSeconds : value} disabled={!!done || paused || busy} onChange={e => setValues({ ...values, [key]: Number(e.target.value) })} /></label>
          {exercise.metricType === 'reps_load' && <label>{tr('公斤', 'kg')}<input type="number" min="0" step="0.5" disabled={!!done || paused || busy} value={done?.loadGrams !== undefined ? Number(done.loadGrams) / 1000 : values[`${key}:kg`] ?? 0} onChange={e => setValues({ ...values, [`${key}:kg`]: Number(e.target.value) })} /></label>}
          <Button workout disabled={!!done || paused || busy || !(value > 0)} onClick={() => void run(async () => { await workflow.recordSet(active.id, item.itemIndex, setIndex, timed ? { durationSeconds: value } : { reps: value, ...(exercise.metricType === 'reps_load' ? { loadGrams: Math.round((values[`${key}:kg`] ?? 0) * 1000) } : {}) }); })}>{done ? tr('已完成', 'Done') : tr('完成本组', 'Complete set')}</Button></div>; })}</Sheet>; })}
    {active.sets.length > 0 && <slots.RestClock label={tr('已歇', 'Rest elapsed')} elapsedSeconds={elapsed} />}
    <Button onClick={() => setPaused(!paused)}>{paused ? tr('继续训练', 'Resume') : tr('暂停', 'Pause')}</Button><Button onClick={() => navigate(`/workout/${active.id}/finish`)}>{tr('结束并记下', 'Finish and record')}</Button></main>;
  else if (path === '/review' && facts) page = <main><h1>{tr('本周回顾', 'This week')}</h1><p>{facts.from} — {facts.to}</p><div className="v8-facts"><Stat label={tr('完整训练', 'Complete')} value={facts.complete} /><Stat label={tr('练了一部分', 'Partial')} value={facts.partial} /><Stat label={tr('动了几次', 'Movement')} value={facts.movementCount} /><Stat label={tr('训练分钟', 'Training minutes')} value={Math.round(facts.trainingSeconds / 60)} /></div>
    <h2>{tr('训练记录', 'Workout history')}</h2>{data.workouts.filter(row => row.status !== 'in_progress').map(row => <Sheet key={row.id}><p>{row.localDate} · {row.sets.length} / {row.plannedSetCount} {tr('组', 'sets')}</p>{row.sets.map((set, index) => <p key={index}>{name(set.exerciseId)} · {set.reps ?? set.durationSeconds} {set.reps !== undefined ? tr('次', 'reps') : tr('秒', 'seconds')}</p>)}{row.feedback?.note && <p>{row.feedback.note}</p>}</Sheet>)}<Button onClick={() => navigate('/')}>{tr('下一次', 'Next workout')}</Button></main>;
  else if (path === '/manual') page = <main><h1>{tr('手动训练', 'Manual training')}</h1><label>{tr('选择动作', 'Choose exercise')}<select value={manualId} onChange={e => setManualId(e.target.value)}>{exercises.slice(0, 4).map(item => <option key={item.id} value={item.id}>{item.name[locale]}</option>)}</select></label><p>{tr('2 组；训练中填写实际次数或时长。', '2 sets; enter actual reps or duration during training.')}</p><Button variant="primary" disabled={busy} onClick={() => void start()}>{tr('开始训练', 'Start training')}</Button></main>;
  else page = <main><h1>{tr('下一次', 'Next workout')}</h1>{facts && data.version && <slots.WeekProgress complete={facts.complete} partial={facts.partial} target={data.version.weeklyTarget} label={tr(`本周完整 ${facts.complete} 次，另有 ${facts.partial} 次练了一部分`, `${facts.complete} complete, ${facts.partial} partial this week`)} />}
    {active ? <Button variant="primary" onClick={() => navigate(`/workout/${active.id}`)}>{tr('继续训练', 'Continue workout')}</Button> : data.version ? data.version.templates.map(template => <Sheet key={template.id}><slots.StartHero name={template.name} templateId={template.id} estimatedMinutes={template.estimatedMinutes} startLabel={tr('开始训练', 'Start training')} disabled={busy} onStart={() => void start(template.id)} />{template.items.map((item, i) => <p key={i}>{name(item.exerciseId)} · {item.sets} {tr('组', 'sets')}</p>)}</Sheet>) : <Button variant="primary" onClick={() => navigate('/onboarding')}>{tr('创建训练计划', 'Create a plan')}</Button>}
    <Button onClick={() => navigate('/manual')}>{tr('手动训练', 'Manual training')}</Button></main>;
  return <div className="v8-shell" data-training-active={training}><header className="v8-shell-header"><slots.BrandMark label="Fitness" /><label>{tr('外观与版式', 'Appearance')}<select value={theme} onChange={e => change(e.target.value as typeof theme)}>{themes.map(item => <option key={item.id} value={item.id}>{item.name[locale]}</option>)}</select></label></header>
    {error && !['/onboarding', '/plan-draft'].includes(path) && <p role="alert">{error}</p>}{page}
    {!path.startsWith('/onboarding') && !path.startsWith('/workout/') && <nav aria-label={tr('主导航', 'Navigation')}>{[['/', 'training', tr('训练', 'Training')], ['/plans', 'plan', tr('计划', 'Plan')], ['/review', 'review', tr('回顾', 'Review')]].map(([href, kind, label]) => <Button key={href} onClick={() => navigate(href)}><slots.NavIcon kind={kind as 'training' | 'plan' | 'review'} selected={path === href} label={label} />{label}</Button>)}</nav>}
  </div>;
}
export default function MainlineApp() { return <ThemeProvider><Mainline /></ThemeProvider>; }

