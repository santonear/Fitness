import { AppIcon, StatusIcon } from '../components/AppIcon';
import { useEffect, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { useTranslation } from 'react-i18next';
import { database } from '../../persistence/db';
import { dateInZone, progressService } from '../../application/progress';
import { profileService } from '../../application/profile';
import { guidedService } from '../../application/guided';
import { bodyWeightService } from '../../application/body-weight';
import type { Exercise, Locale, ProgressMetrics, ProgressReport } from '../../domain/models';
import { HistoryDetail } from '../components/HistoryDetail';
import { StageSummaryPreview } from '../components/StageSummaryPreview';
import type { GuidedMeasurementObservation } from '../components/guided/GuidedMeasurements';

type Stage = { id: string; name: string };
type Observation = GuidedMeasurementObservation;
function rangeStart(today: string, days: number) {
  const date = new Date(today + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() - days + 1);
  return date.toISOString().slice(0, 10);
}
export function ProgressPage() {
  const { i18n } = useTranslation();
  const locale: Locale = i18n.resolvedLanguage === 'zh' ? 'zh' : 'en';
  const tr = (zh: string, en: string) => locale === 'zh' ? zh : en;
  const [timeZone, setTimeZone] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone);
  const today = dateInZone(Date.now(), timeZone);
  const [range, setRange] = useState(30);
  const [from, setFrom] = useState(() => rangeStart(today, 30));
  const [to, setTo] = useState(today);
  const [stage, setStage] = useState('');
  const [category, setCategory] = useState('');
  const [exerciseId, setExerciseId] = useState('');
  const [stages, setStages] = useState<Stage[]>([]);
  const [summaryPlans, setSummaryPlans] = useState<Stage[]>([]);
  const [report, setReport] = useState<ProgressReport>();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [selected, setSelected] = useState('');
  const [error, setError] = useState('');
  const [chart, setChart] = useState<'sessions' | 'duration'>('sessions');
  const [entry, setEntry] = useState(false);
  const [kind, setKind] = useState<Observation['kind']>('weight');
  const [value, setValue] = useState('');
  const [measurementDate, setMeasurementDate] = useState(today);
  const [method, setMethod] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [saveError, setSaveError] = useState('');
  const entryRef = useRef<HTMLDivElement>(null);
  const valueRef = useRef<HTMLInputElement>(null);
  const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);

  useEffect(() => {
    if (range) { setFrom(rangeStart(today, range)); setTo(today); }
  }, [today, range]);

  useEffect(() => {
    const subscription = liveQuery(() => profileService.getProfile()).subscribe({ next: profile => {
      if (profile) setTimeZone(profile.timeZone);
    }, error: reason => setError(String(reason)) });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    setReport(undefined); setObservations([]); setError(''); setSelected('');
    const subscription = liveQuery(async () => {
      const [next, plans, versions, guided] = await Promise.all([
        progressService.queryProgress({ from, to, timeZone, ...(stage ? { planVersionId: stage } : {}) }, Date.now()),
        database.plans.toArray(), database.planVersions.toArray(), guidedService.read(),
      ]);
      return { next, plans, versions, guided };
    }).subscribe({
      next: ({ next, plans, versions, guided }) => {
        setReport(next);
        setSummaryPlans(plans.map(plan => ({ id: plan.id, name: plan.name })));
        setStages(versions.map(version => ({ id: version.id, name: (plans.find(plan => plan.id === version.planId)?.name ?? version.planId) + ' · v' + version.versionNumber })));
        setObservations([
          ...next.bodyWeights.map(row => ({ id: row.id, kind: 'weight' as const, value: row.weightGrams / 1000, date: row.localDate, method: '' })),
          ...guided.observations.filter(row => row.localDate >= from && row.localDate <= to).map(row => ({ id: row.id, kind: row.kind, value: row.value, date: row.localDate, method: row.method })),
        ].sort((a, b) => b.date.localeCompare(a.date)));
      }, error: reason => setError(String(reason)),
    });
    return () => subscription.unsubscribe();
  }, [from, to, stage, timeZone]);

  function openEntry() { setEntry(true); requestAnimationFrame(() => { entryRef.current?.scrollIntoView({ block: 'center', behavior: 'instant' }); valueRef.current?.focus(); }); }
  async function saveObservation(event: React.FormEvent) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setSaveError(''); setSaveMessage('');
    try {
      await profileService.initialize(locale);
      const profile = (await profileService.getProfile())!;
      if (kind === 'weight') await bodyWeightService.saveBodyWeight({ weightGrams: Math.round(Number(value) * 1000), localDate: measurementDate, timeZone: profile.timeZone });
      else {
        const current = await guidedService.read();
        await guidedService.saveObservation({ id: crypto.randomUUID(), kind, value: Number(value), unit: kind === 'waist' ? 'cm' : '%', localDate: measurementDate, timeZone: profile.timeZone, method: method.trim(), createdAt: new Date().toISOString() }, current.revision);
      }
      setValue(''); setMethod(''); setSaveMessage(tr('身体记录已保存在本机。', 'Measurement saved on this device.'));
    } catch (failure) { setSaveError(failure instanceof Error ? failure.message : String(failure)); }
    finally { setSaving(false); }
  }
  const completedSets = report?.historySets.filter(set => set.completed) ?? [];
  const hasDuration = completedSets.some(set => set.durationSeconds !== undefined);
  const hasVolume = completedSets.some(set => set.metricType === 'reps_load');
  const dates = [...new Set(report?.history.map(session => session.localDate) ?? [])].sort();
  const chartRows = dates.map(date => {
    const sessions = report!.history.filter(session => session.localDate === date);
    const ids = new Set(sessions.map(session => session.id));
    const timed = completedSets.filter(set => ids.has(set.sessionId) && set.durationSeconds !== undefined);
    return { date, count: sessions.length, duration: timed.length ? timed.reduce((sum, set) => sum + set.durationSeconds!, 0) / 60 : null };
  });
  const values = chartRows.map(row => chart === 'sessions' ? row.count : row.duration);
  const max = Math.max(1, ...values.filter((value): value is number => value !== null));
  const firstDay = Date.parse((dates[0] ?? today) + 'T00:00:00Z');
  const span = Date.parse((dates.at(-1) ?? today) + 'T00:00:00Z') - firstDay;
  const points = values.map((value, index) => value === null ? null : { x: 28 + (span ? (Date.parse(chartRows[index].date + 'T00:00:00Z') - firstDay) / span : .5) * 544, y: 166 - value / max * 130 });
  const latestWeight = observations.find(row => row.kind === 'weight');
  const earliestWeight = [...observations].reverse().find(row => row.kind === 'weight');
  const change = latestWeight && earliestWeight && latestWeight.id !== earliestWeight.id ? latestWeight.value - earliestWeight.value : null;
  const units = { weight: 'kg', waist: 'cm', bodyFat: '%' };
  const kindLabels = { weight: tr('体重', 'Weight'), waist: tr('腰围', 'Waist'), bodyFat: tr('体脂率', 'Body fat') };
  const limits = { weight: [30, 300], waist: [40, 200], bodyFat: [3, 65] };
  const categoryName = (key: Exercise['category']) => ({ strength: tr('力量', 'Strength'), cardio: tr('有氧', 'Cardio'), bodyweight: tr('徒手', 'Bodyweight') })[key];
  const history = report?.history.filter(session => !category || session.exerciseSnapshots.some(exercise => exercise.category === category)) ?? [];
  const categoryRows = report?.categoryTrends.filter(row => !category || row.category === category) ?? [];
  const exerciseRows = report?.exerciseTrends.filter(row => !category || report.history.some(session => session.exerciseSnapshots.some(exercise => exercise.exerciseId === row.exerciseId && exercise.category === category))) ?? [];
  const exerciseChoices = [...new Map(exerciseRows.map(row => [row.exerciseId, row.name])).entries()];
  const currentExercise = exerciseChoices.some(([id]) => id === exerciseId) ? exerciseId : exerciseChoices[0]?.[0];
  return <div className="v31-progress">
    <header className="v31-section-head"><div><p className="v31-eyebrow">YOUR TRAINING · PROGRESS</p><h1>{tr('看见真实进步，不追逐虚构分数', 'See real progress, not invented scores')}</h1><p>{tr('训练、完成率、负荷和身体记录分别解释，来自本机保存的真实记录。', 'Training, completion, load and body measurements tell different stories, based on records saved on this device.')}</p></div><button onClick={openEntry}>＋ {tr('记录身体变化', 'Record a measurement')}</button></header>
    <div className="v31-content-toolbar" role="group" aria-label={tr('查看范围', 'Date range')}><span>{tr('查看范围', 'Date range')}</span>{[7, 30, 90, 180].map(days => <button key={days} aria-pressed={range === days} onClick={() => { setRange(days); setFrom(rangeStart(today, days)); setTo(today); }}>{days} {tr('天', 'days')}</button>)}<small>{from} — {to}</small></div>
    <div className="v31-history-filter"><label>{tr('分类', 'Category')}<select aria-label={tr('分类', 'Category')} value={category} onChange={event => { setCategory(event.target.value); setSelected(''); }}><option value="">{tr('所有分类', 'All categories')}</option>{(['strength', 'cardio', 'bodyweight'] as const).map(key => <option key={key} value={key}>{categoryName(key)}</option>)}</select></label><small>{tr('分类仅筛选历史及详细趋势；上方范围决定总览。', 'Category filters history and detailed trends; the date range controls the overview.')}</small></div>
    {error && <p role="alert"><StatusIcon status="error"/>{error}</p>}
    {!report && !error && <p role="status"><AppIcon name="info"/>{tr('正在读取本地记录…', 'Reading local records…')}</p>}
    <div className="v31-metric-grid" aria-busy={!report}>
      {[
        [tr('完成训练', 'Completed workouts'), report ? String(report.history.length) : '—', tr('按训练记录计次，不按日期合并', 'Each session counts separately')],
        [tr('总记录时长', 'Total recorded duration'), report && hasDuration ? number(report.totals.durationSeconds / 60) + ' min' : '—', tr('已完成计时组；不等于全程耗时', 'Completed timed sets, not elapsed session time')],
        [tr('实际训练量', 'Recorded volume'), report && hasVolume ? number(report.totals.volumeGrams / 1000) + ' kg·' + tr('次', 'reps') : '—', tr('已完成组的负重 × 次数', 'Load × reps from completed sets')],
      ].map(([label, value, note]) => <article className="v31-metric" key={label}><span>{label}</span><strong>{value}</strong><small>{note}</small></article>)}
    </div>
    <div className="v31-progress-grid">
      <section className="v31-progress-card v31-trend-card">
        <div className="v31-section-head"><div><h2>{tr('训练趋势', 'Training trends')}</h2><p>{tr('仅统计已完成训练，缺失时长不补成零。', 'Completed sessions only. Missing duration is not zero.')}</p></div><div className="v31-chart-controls" role="group" aria-label={tr('趋势指标', 'Trend metric')}><button aria-pressed={chart === 'sessions'} onClick={() => setChart('sessions')}>{tr('训练次数', 'Workouts')}</button><button aria-pressed={chart === 'duration'} onClick={() => setChart('duration')}>{tr('训练时长', 'Duration')}</button></div></div>
        <div className="v31-trend-wrap"><div className="v31-chart">
          {values.some(value => value !== null) ? <svg viewBox="0 0 600 205" role="img" aria-label={chart === 'sessions' ? tr('按实际日期的训练次数', 'Workouts by actual date') : tr('按实际日期的已记录时长，单位分钟', 'Recorded duration by actual date, in minutes')}>
            {[0, 1, 2, 3].map(index => <line key={index} x1="28" x2="572" y1={166 - index * 43.33} y2={166 - index * 43.33} className="v31-chart-gridline" />)}
            {points.map((point, index) => point && <g key={chartRows[index].date}>{index > 0 && points[index - 1] && <line x1={points[index - 1]!.x} y1={points[index - 1]!.y} x2={point.x} y2={point.y} className="v31-chart-line" />}<circle cx={point.x} cy={point.y} r="4" className="v31-chart-point"><title>{chartRows[index].date + ': ' + number(values[index]!)}</title></circle></g>)}
            <text x="28" y="193">{chartRows[0]?.date.slice(5)}</text><text x="572" y="193" textAnchor="end">{chartRows.at(-1)?.date.slice(5)}</text><text x="28" y="20">{number(max)} {chart === 'duration' ? 'min' : tr('次', 'workouts')}</text>
          </svg> : <div className="v31-empty"><p>{report ? tr('此范围暂无可展示的记录。完成训练并保存组记录后，趋势会显示在这里。', 'No records to show in this range. Complete workouts and save sets to see your trend.') : tr('读取中…', 'Loading…')}</p></div>}
          {chartRows.length === 1 && <p className="v31-footnote">{tr('目前只有一天记录，暂不足以判断趋势。', 'One recorded day is not enough to establish a trend.')}</p>}
          {chartRows.length > 0 && <details><summary>{tr('查看图表数据', 'View chart data')}</summary><ul className="v31-chart-data">{chartRows.map(row => <li key={row.date}><time>{row.date}</time><span>{chart === 'sessions' ? row.count : row.duration === null ? '—' : number(row.duration)} {chart === 'duration' ? 'min' : tr('次', 'workouts')}</span></li>)}</ul></details>}
        </div><aside className="v31-trend-note"><span>{tr('完成率', 'Completion rate')}</span><strong>{report?.completionRate == null ? '—' : number(report.completionRate * 100) + '%'}</strong><p>{report?.dueCount ? report.completedCount + ' / ' + report.dueCount + ' ' + tr('项到期任务', 'due tasks') : tr('暂无到期任务', 'No tasks due')}</p><small>{tr('按原计划日期及计划时区，过完当天才计入；跳过、漏练仍计入，临时训练不影响完成率。', 'Tasks count after their original day ends in the plan time zone. Skipped and missed tasks count; temporary workouts do not affect this rate.')}</small></aside></div>
      </section>
      <section className="v31-progress-card v31-body-card"><h2>{tr('身体记录', 'Body measurements')}</h2><p>{tr('长期观察比单次波动更有参考价值。', 'Longer-term observations matter more than a single fluctuation.')}</p><strong className="v31-body-value">{change === null ? '—' : (change > 0 ? '+' : '') + number(change)} <small>kg</small></strong><p>{tr('所选范围内的体重变化', 'Weight change within this range')}</p><div className="v31-body-latest">{latestWeight ? <><strong>{number(latestWeight.value)} kg</strong><time>{latestWeight.date}</time></> : <p>{tr('尚无体重观测；缺测不记为零。', 'No weight observations. Missing measurements are not zero.')}</p>}</div><button onClick={openEntry}>{tr('新增观测', 'Add measurement')}</button>
        <div ref={entryRef}>{entry && <form className="v31-measurement-form" onSubmit={saveObservation}><label>{tr('测量指标', 'Measurement')}<select value={kind} disabled={saving} onChange={event => { setKind(event.target.value as Observation['kind']); setValue(''); }}>{Object.entries(kindLabels).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</select></label><label>{kindLabels[kind]} ({units[kind]})<input ref={valueRef} required type="number" step=".1" min={limits[kind][0]} max={limits[kind][1]} value={value} disabled={saving} onChange={event => setValue(event.target.value)} /></label><label>{tr('测量日期', 'Measurement date')}<input type="date" required value={measurementDate} disabled={saving} onChange={event => setMeasurementDate(event.target.value)} /></label>{kind !== 'weight' && <label>{tr('测量方法或来源', 'Method or source')}<input required maxLength={200} value={method} disabled={saving} onChange={event => setMethod(event.target.value)} /></label>}<button type="submit" disabled={saving}>{saving ? tr('保存中…', 'Saving…') : tr('确认保存测量值', 'Save measurement')}</button><button type="button" disabled={saving} onClick={() => setEntry(false)}>{tr('收起', 'Close')}</button></form>}</div>
        {saveError && <p role="alert"><StatusIcon status="warning"/>{saveError}</p>}{saveMessage && <p role="status"><AppIcon name="info"/>{saveMessage}</p>}
        <details className="v31-measurement-history"><summary>{tr('测量历史', 'Measurement history')} ({observations.length})</summary>{observations.length ? <ol>{observations.map(row => <li key={row.id}><time>{row.date}</time><strong>{kindLabels[row.kind]} · {number(row.value)} {units[row.kind]}</strong>{row.method && <span>{row.method}</span>}</li>)}</ol> : <p>{tr('此日期范围尚无身体记录。', 'No measurements in this date range.')}</p>}</details>
      </section>
      <section className="v31-progress-card v31-progress-wide"><div className="v31-section-head"><div><h2>{tr('最近训练历史', 'Recent training history')}</h2><p>{tr('展开查看当时的固定快照，完成后只读。', 'Open the saved snapshot. Completed records are read-only.')}</p></div><span className="v31-badge">{tr('已完成事实', 'Completed records')}</span></div>
        {report && history.length ? history.map(session => <article className="v31-history-row" key={session.id}><div className="v31-history-summary"><div><time>{session.localDate}</time><h3>{session.exerciseSnapshots.map(exercise => exercise.name[locale]).join(' · ') || tr('训练记录', 'Workout')}</h3><p>{session.timeZone} · {session.planVersionId ? tr('计划训练', 'Planned workout') : tr('临时训练', 'Temporary workout')}</p></div><button aria-expanded={selected === session.id} aria-controls={'history-' + session.id} onClick={() => setSelected(selected === session.id ? '' : session.id)}>{selected === session.id ? tr('收起详情', 'Hide details') : tr('查看历史详情', 'View history details')}</button></div>{selected === session.id && <div id={'history-' + session.id}><HistoryDetail session={session} sets={report.historySets.filter(set => set.sessionId === session.id)} schedule={report.historySchedules.find(row => row.completedSessionId === session.id)} locale={locale} /></div>}</article>) : <div className="v31-empty">{tr('此筛选下暂无已完成训练。', 'No completed training in this selection.')}</div>}
      </section>
      <section className="v31-progress-card v31-progress-wide"><details><summary>{tr('更多筛选与阶段总结', 'More filters and stage summaries')}</summary><div className="v31-advanced-filters"><label>{tr('起始日期', 'From date')}<input type="date" value={from} onChange={event => { setRange(0); setFrom(event.target.value); }} /></label><label>{tr('结束日期', 'To date')}<input type="date" value={to} onChange={event => { setRange(0); setTo(event.target.value); }} /></label><label>{tr('计划阶段', 'Plan stage')}<select value={stage} onChange={event => setStage(event.target.value)}><option value="">{tr('所有阶段与临时训练', 'All stages and temporary workouts')}</option>{stages.map(row => <option key={row.id} value={row.id}>{row.name}</option>)}</select></label></div><StageSummaryPreview locale={locale} plans={summaryPlans} /></details></section>
      <section className="v31-progress-card v31-progress-wide"><details><summary>{tr('分类与同动作趋势', 'Category and same-exercise trends')}</summary><h3>{tr('分类趋势', 'Category trends')}</h3><ProgressMetricRows rows={categoryRows.map(row => ({ ...row, label: categoryName(row.category) }))} locale={locale} /><h3>{tr('同动作趋势', 'Same-exercise trends')}</h3>{exerciseChoices.length > 0 && <label>{tr('比较动作', 'Compare exercise')}<select value={currentExercise} onChange={event => setExerciseId(event.target.value)}>{exerciseChoices.map(([id, name]) => <option value={id} key={id}>{name[locale]}</option>)}</select></label>}<ProgressMetricRows rows={exerciseRows.filter(row => row.exerciseId === currentExercise).map(row => ({ ...row, label: row.name[locale] }))} locale={locale} /></details></section>
    </div><p className="v31-footnote">{tr('训练表现和身体测量存在自然波动；这里的趋势不是医疗结论。身体记录保存在本机，不会因查看进度而发送给 AI。', 'Training performance and body measurements naturally fluctuate. Trends are not medical conclusions. Measurements remain on this device; viewing progress does not send them to AI.')}</p>
  </div>;
}

function ProgressMetricRows({ rows, locale }: { rows: (ProgressMetrics & { localDate: string; label: string })[]; locale: Locale }) {
  const zh = locale === 'zh';
  return rows.length ? <div className="v31-metric-table-wrap" tabIndex={0}><table><thead><tr><th>{zh ? '日期 / 类型' : 'Date / type'}</th><th>{zh ? '次数' : 'Reps'}</th><th>{zh ? '累计负重 kg' : 'Summed load kg'}</th><th>{zh ? '训练量 kg·次' : 'Volume kg·reps'}</th><th>{zh ? '时长 s' : 'Duration s'}</th><th>{zh ? '已知距离 km' : 'Known distance km'}</th></tr></thead><tbody>{rows.map((row, index) => <tr key={index}><th>{row.localDate}<br />{(row as typeof row & { label: string }).label}</th><td>{row.reps}</td><td>{row.loadGrams / 1000}</td><td>{row.volumeGrams / 1000}</td><td>{row.durationSeconds}</td><td>{row.distanceMeters === null ? '—' : row.distanceMeters / 1000}{row.missingDistanceSets > 0 && <small> · {row.missingDistanceSets} {zh ? '组未记录距离' : 'sets without distance'}</small>}</td></tr>)}</tbody></table></div> : <p>{zh ? '暂无已完成组可比较。' : 'No completed sets to compare.'}</p>;
}
