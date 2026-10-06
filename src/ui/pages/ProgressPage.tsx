import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { database } from '../../persistence/db';
import { dateInZone, progressService } from '../../application/progress';
import type { Exercise, Locale, ProgressMetrics, ProgressReport } from '../../domain/models';
import { HistoryDetail } from '../components/HistoryDetail';
import { StageSummaryPreview } from '../components/StageSummaryPreview';

type Stage = { id: string; name: string };

function MetricsTable({ rows, zh }: {
  rows: (ProgressMetrics & { localDate: string; label: string })[];
  zh: boolean;
}) {
  return (
    <div className="progress-table-scroll" tabIndex={0}>
      <table className="progress-table">
        <thead><tr>
          <th>{zh ? '日期 / 类型' : 'Date / type'}</th>
          <th>{zh ? '次数' : 'Reps'}</th>
          <th>{zh ? '累计负重 kg' : 'Summed load kg'}</th>
          <th>{zh ? '训练量 kg·次' : 'Volume kg·reps'}</th>
          <th>{zh ? '时长 s' : 'Duration s'}</th>
          <th>{zh ? '已知距离 km' : 'Known distance km'}</th>
        </tr></thead>
        <tbody>{rows.map((row, index) => <tr key={`${row.localDate}:${row.label}:${index}`}>
          <th>{row.localDate}<br />{row.label}</th>
          <td>{row.reps}</td><td>{row.loadGrams / 1000}</td><td>{row.volumeGrams / 1000}</td><td>{row.durationSeconds}</td>
          <td>{row.distanceMeters === null ? '—' : row.distanceMeters / 1000}{row.missingDistanceSets > 0 && <small> · {row.missingDistanceSets} {zh ? '组未记录距离' : 'sets without distance'}</small>}</td>
        </tr>)}</tbody>
      </table>
    </div>
  );
}

export function ProgressPage() {
  const { i18n } = useTranslation();
  const locale: Locale = i18n.resolvedLanguage === 'zh' ? 'zh' : 'en';
  const zh = locale === 'zh';
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const [from, setFrom] = useState('1970-01-01');
  const [to, setTo] = useState(() => dateInZone(Date.now(), timeZone));
  const [stage, setStage] = useState('');
  const [stages, setStages] = useState<Stage[]>([]);
  const [summaryPlans, setSummaryPlans] = useState<Stage[]>([]);
  const [category, setCategory] = useState('');
  const [exerciseId, setExerciseId] = useState('');
  const [report, setReport] = useState<ProgressReport>();
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let current = true;
    setReport(undefined);
    setSelected('');
    setError('');
    void progressService.queryProgress({ from, to, timeZone, ...(stage ? { planVersionId: stage } : {}) }, Date.now())
      .then(next => { if (current) setReport(next); })
      .catch(reason => { if (current) setError((reason as Error).message); });
    return () => { current = false; };
  }, [from, to, stage, timeZone]);

  useEffect(() => {
    let current = true;
    void database.transaction('r', database.plans, database.planVersions, async () => {
      const plans = await database.plans.toArray();
      const versions = await database.planVersions.toArray();
      return { plans: plans.map(plan => ({ id: plan.id, name: plan.name })), stages: versions.map(version => ({
        id: version.id,
        name: `${plans.find(plan => plan.id === version.planId)?.name ?? version.planId} · v${version.versionNumber}`,
      })) };
    }).then(next => { if (current) { setStages(next.stages); setSummaryPlans(next.plans); } }).catch(reason => { if (current) setError((reason as Error).message); });
    return () => { current = false; };
  }, []);

  const categoryName = (value: Exercise['category']) => zh ? ({ strength: '力量', cardio: '有氧', bodyweight: '徒手' }[value]) : ({ strength: 'Strength', cardio: 'Cardio', bodyweight: 'Bodyweight' }[value]);
  const history = report?.history.filter(session => !category || session.exerciseSnapshots.some(exercise => exercise.category === category)) ?? [];
  const categoryRows = report?.categoryTrends.filter(point => !category || point.category === category) ?? [];
  const exercisePoints = report?.exerciseTrends.filter(point => !category || report.history.some(session => session.exerciseSnapshots.some(exercise => exercise.exerciseId === point.exerciseId && exercise.category === category))) ?? [];
  const exerciseChoices = [...new Map(exercisePoints.map(point => [point.exerciseId, point.name])).entries()];
  const currentExercise = exerciseChoices.some(([id]) => id === exerciseId) ? exerciseId : exerciseChoices[0]?.[0];

  return (
    <>
      <h1>{zh ? '训练进度' : 'Progress'}</h1>
      <StageSummaryPreview locale={locale} plans={summaryPlans} />
      <form className="progress-filters" onSubmit={event => event.preventDefault()}>
        <label>{zh ? '起始日期' : 'From date'}<input type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
        <label>{zh ? '结束日期' : 'To date'}<input type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
        <label>{zh ? '计划阶段' : 'Plan stage'}<select value={stage} onChange={event => setStage(event.target.value)}>
          <option value="">{zh ? '所有阶段与临时训练' : 'All stages and temporary workouts'}</option>
          {stages.map(value => <option key={value.id} value={value.id}>{value.name}</option>)}
        </select></label>
        <label>{zh ? '分类' : 'Category'}<select value={category} onChange={event => { setCategory(event.target.value); setSelected(''); }}>
          <option value="">{zh ? '所有分类' : 'All categories'}</option>
          {(['strength', 'cardio', 'bodyweight'] as const).map(value => <option key={value} value={value}>{categoryName(value)}</option>)}
        </select></label>
      </form>
      {error && <p role="alert">{error}</p>}
      {!report && !error && <p>{zh ? '正在读取本地记录…' : 'Reading local records…'}</p>}
      {report && <>
        <section className="progress-section" aria-label={zh ? '阶段完成率' : 'Stage completion'}>
          <h2>{zh ? '阶段完成率' : 'Stage completion'}</h2>
          <p className="completion-number">{report.completionRate === null ? (zh ? '暂无到期任务' : 'No tasks due') : `${Math.round(report.completionRate * 100)}%`}</p>
          {report.dueCount > 0 && <p>{report.completedCount} / {report.dueCount} {zh ? '项到期任务已完成' : 'due tasks completed'}</p>}
          <p className="muted">{zh ? '按原计划日期及计划时区，过完当天才计入分母；跳过、漏练仍计入。补练回计原阶段。分类筛选仅影响历史与趋势。' : 'Tasks enter the denominator after their original day ends in the plan’s time zone. Skipped and missed tasks count; make-ups credit their original stage. Category filters affect history and trends only.'}</p>
        </section>
        <section className="progress-section" aria-label={zh ? '训练历史' : 'Training history'}>
          <h2>{zh ? '训练历史' : 'Training history'}</h2>
          <p className="muted">{zh ? '按实际训练日期，只统计已完成训练；临时训练不影响计划完成率。' : 'Completed sessions by actual training date. Temporary workouts do not affect plan completion.'}</p>
          {history.length === 0 ? <p>{zh ? '此筛选下暂无已完成训练。' : 'No completed training in this selection.'}</p> : history.map(session => <article className="history-row" key={session.id}>
            <p>{session.localDate} · {session.timeZone} · {session.planVersionId ? (zh ? '计划训练' : 'Planned workout') : (zh ? '临时训练' : 'Temporary workout')}</p>
            <p>{session.exerciseSnapshots.map(exercise => exercise.name[locale]).join(' · ')}</p>
            <button aria-expanded={selected === session.id} onClick={() => setSelected(selected === session.id ? '' : session.id)}>{zh ? '查看历史详情' : 'View history details'}</button>
            {selected === session.id && <HistoryDetail session={session} sets={report.historySets.filter(set => set.sessionId === session.id)} schedule={report.historySchedules.find(row => row.completedSessionId === session.id)} locale={locale} />}
          </article>)}
        </section>
        <section className="progress-section">
          <h2>{zh ? '分类趋势' : 'Category trends'}</h2>
          {categoryRows.length ? <MetricsTable zh={zh} rows={categoryRows.map(point => ({ ...point, label: categoryName(point.category) }))} /> : <p>{zh ? '暂无已完成组可比较。' : 'No completed sets to compare.'}</p>}
          <h2>{zh ? '同动作趋势' : 'Same-exercise trends'}</h2>
          {exerciseChoices.length > 0 && <label className="progress-exercise-choice">{zh ? '比较动作' : 'Compare exercise'}<select value={currentExercise} onChange={event => setExerciseId(event.target.value)}>
            {exerciseChoices.map(([id, name]) => <option key={id} value={id}>{name[locale]}</option>)}
          </select></label>}
          {exerciseChoices.length ? <MetricsTable zh={zh} rows={exercisePoints.filter(point => point.exerciseId === currentExercise).map(point => ({ ...point, label: point.name[locale] }))} /> : <p>{zh ? '暂无同动作记录。' : 'No same-exercise records.'}</p>}
          <p className="muted">{zh ? '各指标独立比较，负重为记录负重之和，训练量为负重×次数。— 表示距离未知，不补成零。' : 'Metrics remain separate. Summed load adds recorded loads; volume is load × reps. — means unknown distance, never an invented zero.'}</p>
        </section>
        <section className="progress-section">
          <h2>{zh ? '体重观测' : 'Weight observations'}</h2>
          {report.bodyWeights.length ? <ul>{report.bodyWeights.map(value => <li key={value.id}>{value.localDate} · {value.weightGrams / 1000} kg · {value.timeZone}</li>)}</ul> : <p>{zh ? '此日期范围没有体重观测。' : 'No weight observations in this date range.'}</p>}
          <p className="muted">{zh ? '只展示真实观测，缺测日期保持空缺。' : 'Only real observations are shown; missing dates remain gaps.'}</p>
        </section>
        <p className="muted">{zh ? '当前进度由本地事实计算。可选 AI 总结仅在核对发送范围并确认后调用。' : 'Progress is calculated from local facts. Optional AI summaries require a reviewed sending scope and explicit confirmation.'}</p>
      </>}
    </>
  );
}
