import { useEffect, useRef, useState } from 'react';
import type { Locale } from '../../domain/models';
import { stageSummaryService, type StageSelection, type StageSummaryResult } from '../../application/stage-summary';
import { dateInZone } from '../../application/progress';
import { HistoryDetail } from './HistoryDetail';
import { database } from '../../persistence/db';
import { liveQuery } from 'dexie';
import { StageSummaryAi } from './StageSummaryAi';

export function StageSummaryPreview({ locale, plans }: { locale: Locale; plans: { id: string; name: string }[] }) {
  const zh = locale === 'zh';
  const [timeZone, setTimeZone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [hasSavedZone, setHasSavedZone] = useState(false);
  useEffect(() => {
    const subscription = liveQuery(() => database.profiles.toCollection().first()).subscribe({
      next: profile => { if (profile) { setTimeZone(profile.timeZone); setHasSavedZone(true); } },
      error: reason => setResult({ ok: false, code: 'INVALID_FACTS', detail: (reason as Error).message }),
    });
    return () => subscription.unsubscribe();
  }, []);
  const today = dateInZone(Date.now(), timeZone ?? 'UTC');
  const [kind, setKind] = useState<StageSelection['kind']>('dateRange');
  const [planId, setPlanId] = useState('');
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [result, setResult] = useState<StageSummaryResult>();
  const [busy, setBusy] = useState(false);
  const requestSequence = useRef(0);
  const reset = () => { requestSequence.current++; setResult(undefined); setBusy(false); };
  useEffect(() => { if (timeZone) { const date = dateInZone(Date.now(), timeZone); setFrom(date); setTo(date); reset(); } }, [timeZone]);
  const prepare = async () => {
    if (!timeZone) return;
    if (busy) return;
    reset(); setBusy(true);
    const sequence = requestSequence.current;
    const selection: StageSelection = kind === 'dateRange' ? { kind, from, to, timeZone } : kind === 'planWeek' ? { kind, planId, from, timeZone } : { kind, planId, timeZone };
    try { const next = await stageSummaryService.prepare(selection, Date.now()); if (sequence === requestSequence.current) setResult(next); }
    catch (reason) { if (sequence === requestSequence.current) setResult({ ok: false, code: 'INVALID_FACTS', detail: (reason as Error).message }); }
    finally { if (sequence === requestSequence.current) setBusy(false); }
  };
  return <section className="progress-section" style={{ overflowWrap: 'anywhere', minWidth: 0 }} aria-label={zh ? '阶段总结本地准备' : 'Local stage summary preparation'}>
    <h2>{zh ? '阶段总结本地准备' : 'Local stage summary preparation'}</h2>
    <p>{zh ? '仅在本机准备事实预览，不调用模型或发送数据；可选 AI 总结需要另行核对并确认发送。' : 'Preparing a local facts preview does not call a model or send data. Optional AI summaries require a separate reviewed and confirmed sending scope.'}</p>
    <p className="muted">{hasSavedZone ? (zh ? '资料日历时区' : 'Saved profile calendar time zone') : (zh ? '浏览器显示时区（尚未读取保存的资料）' : 'Browser display time zone (saved profile not yet available)')}: {timeZone}. {zh ? '保留记录的原始本地日期，不转换旧记录日期。' : 'Original local dates are retained; existing record dates are not converted.'}</p>
    <form className="progress-filters" onSubmit={event => { event.preventDefault(); void prepare(); }}>
      <label>{zh ? '总结范围' : 'Summary scope'}<select disabled={busy} value={kind} onChange={event => { setKind(event.target.value as StageSelection['kind']); reset(); }}>
        <option value="dateRange">{zh ? '自选日期范围' : 'Custom date range'}</option>
        <option value="planWeek">{zh ? '某周（连续7个日历日）' : 'One week (7 calendar days)'}</option>
        <option value="wholePlan">{zh ? '整份计划（所有版本）' : 'Whole plan (all versions)'}</option>
      </select></label>
      {kind !== 'dateRange' && <label>{zh ? '总结计划' : 'Summary plan'}<select disabled={busy} value={planId} onChange={event => { setPlanId(event.target.value); reset(); }}>
        <option value="">{zh ? '选择计划' : 'Select a plan'}</option>{plans.map(plan => <option key={plan.id} value={plan.id}>{plan.name}</option>)}
      </select></label>}
      {kind !== 'wholePlan' && <label>{kind === 'planWeek' ? (zh ? '周起始日' : 'Week start date') : (zh ? '总结起始日' : 'Summary from date')}<input disabled={busy} type="date" value={from} onChange={event => { setFrom(event.target.value); reset(); }} /></label>}
      {kind === 'dateRange' && <label>{zh ? '总结结束日' : 'Summary to date'}<input disabled={busy} type="date" value={to} onChange={event => { setTo(event.target.value); reset(); }} /></label>}
      <button disabled={busy || !timeZone} type="submit">{busy ? (zh ? '正在读取…' : 'Reading…') : (zh ? '准备本地预览' : 'Prepare local preview')}</button>
    </form>
    <p className="muted">{zh ? '周由所选起始日连续计算7个日历日。整份计划按各版本原始周期取首尾；日期计划保留原单日范围。训练按实际日期选择，完成率按原任务日期及计划时区计算，范围外补练仍可回计原任务。体重是资料级观测。' : 'A week is 7 calendar days from the chosen start. Whole plans span their original version periods; date plans retain their original day. Sessions use actual dates; completion uses original task dates and each plan time zone. Later make-ups may credit original tasks. Weight observations belong to the local profile.'}</p>
    {result && !result.ok && <p role="alert">{result.code}: {result.code === 'EMPTY_STAGE' ? (zh ? '此范围没有已完成训练或体重观测。' : 'No completed sessions or weight observations in this range.') : result.code === 'INVALID_RANGE' ? (zh ? '请选择有效计划及首尾日期。' : 'Select a valid plan and inclusive date range.') : (zh ? '无法读取完整本地事实。请确认资料已初始化，并重新打开进度页后再试。' : 'Complete local facts are unavailable. Check that your profile is initialized, then reopen Progress and try again.')}</p>}
    {result?.ok && <div role="region" aria-label={zh ? '阶段事实预览' : 'Stage facts preview'}>
      <p>{result.range.from} → {result.range.to} · {result.range.timeZone}</p>
      <p>{zh ? '来源：已提交本地事实' : 'Source: committed local facts'} · {result.manifest.capturedAt}<br />{zh ? '数据修订' : 'Data revision'} {result.manifest.dataRevision} · {zh ? '恢复代次' : 'Restore generation'} {result.manifest.restoreGeneration}</p>
      <p>{result.manifest.counts.sessions} {zh ? '次已完成训练' : 'completed sessions'} · {result.manifest.counts.sets} {zh ? '组已完成记录' : 'completed sets'} · {result.manifest.counts.scheduledWorkouts} {zh ? '项原始任务' : 'original tasks'} · {result.manifest.counts.bodyWeights} {zh ? '条体重观测' : 'weight observations'}</p>
      <p>{zh ? '原任务完成率' : 'Original task completion'}: {result.report.completedCount} / {result.report.dueCount} · {result.report.completionRate === null ? (zh ? '无到期任务' : 'No tasks due') : `${Math.round(result.report.completionRate * 100)}%`}</p>
      <div className="progress-table-scroll" tabIndex={0}><table className="progress-table">
        <thead><tr><th>{zh ? '记录类型' : 'Metric type'}</th><th>{zh ? '已完成组' : 'Completed sets'}</th><th>{zh ? '次数' : 'Reps'}</th><th>{zh ? '累计负重 kg' : 'Summed load kg'}</th><th>{zh ? '时长 s' : 'Duration s'}</th><th>{zh ? '已知距离 m' : 'Known distance m'}</th></tr></thead>
        <tbody>{(['reps_load', 'reps', 'duration', 'duration_distance'] as const).map(type => {
          const sets = result.payload.sets.filter(set => set.metricType === type);
          const sum = (field: 'reps' | 'loadGrams' | 'durationSeconds' | 'distanceMeters', divisor = 1) => {
            const known = sets.filter(set => set[field] !== undefined);
            return known.length ? known.reduce((total, set) => total + set[field]!, 0) / divisor : '—';
          };
          const missing = type === 'duration_distance' ? sets.filter(set => set.distanceMeters === undefined).length : 0;
          return <tr key={type}><th>{type}</th><td>{sets.length}</td><td>{sum('reps')}</td><td>{sum('loadGrams', 1000)}</td><td>{sum('durationSeconds')}</td><td>{sum('distanceMeters')}{missing > 0 && <small> · {missing} {zh ? '组未记录' : 'sets missing'}</small>}</td></tr>;
        })}</tbody>
      </table></div>
      {result.goals.map(goal => <p key={goal.planVersionId}>{zh ? '目标来源' : 'Goal source'}: {goal.planId} · {goal.planVersionId} · {goal.goal.goal || (zh ? '未填写' : 'Not provided')}</p>)}
      {result.payload.sessions.map(session => <article className="history-row" key={session.id}>
        <p>{session.localDate} · {session.timeZone} · {session.id} · {session.planVersionId ?? (zh ? '临时训练' : 'Temporary workout')}</p>
        <HistoryDetail session={session} sets={result.payload.sets.filter(set => set.sessionId === session.id)} schedule={result.payload.scheduledWorkouts.find(row => row.completedSessionId === session.id)} locale={locale} />
      </article>)}
      {result.payload.scheduledWorkouts.map(row => <p key={row.id}>{zh ? '任务归属' : 'Task attribution'}: {row.id} · {row.planVersionId} · {row.plannedDayId} · {row.originalDate} → {row.scheduledDate} · {row.completedSessionId ?? (zh ? '未关联完成记录' : 'No completed session link')}</p>)}
      {result.payload.bodyWeights.map(row => <p key={row.id}>{row.localDate} · {row.weightGrams / 1000} kg · {row.timeZone} · {row.id}</p>)}
      <p className="muted">{zh ? '四种记录类型分别保留；未记录指标显示空缺，记录的 0 保留为 0。此预览不会写入备忘、计划或训练记录；后续发送须另行确认。' : 'All four metric types remain separate. Missing metrics remain absent; recorded zero stays zero. This preview does not save memos, plans or training records. Sending would require a separate confirmation.'}</p>
    </div>}
    <StageSummaryAi prepared={result?.ok?result:undefined} locale={locale}/>
  </section>;
}
