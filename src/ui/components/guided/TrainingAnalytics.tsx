import { AppIcon, StatusIcon } from '../AppIcon';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { liveQuery } from 'dexie';
import { progressService } from '../../../application/progress';
import type { ProgressReport } from '../../../domain/models';

export function summarizeAnalytics(report: ProgressReport) {
  const months = new Map<string, { month: string; workouts: number; volume: number; seconds: number }>();
  const point = (month: string) => { if (!months.has(month)) months.set(month,{month,workouts:0,volume:0,seconds:0}); return months.get(month)!; };
  for (const session of report.history) point(session.localDate.slice(0,7)).workouts++;
  for (const trend of report.categoryTrends) { const row = point(trend.localDate.slice(0,7)); row.volume += trend.volumeGrams / 1000; row.seconds += trend.durationSeconds; }
  const recorded = report.historySets.filter(set => set.completed);
  return { months:[...months.values()].sort((a,b)=>a.month.localeCompare(b.month)), days:new Set(report.history.map(session=>session.localDate)).size,
    hasVolume:recorded.some(set=>set.metricType==='reps_load'), hasDuration:recorded.some(set=>set.metricType==='duration'||set.metricType==='duration_distance'),
    exerciseCount:new Set(report.exerciseTrends.map(point=>point.exerciseId)).size };
}

function AnalyticsChart({ title, unit, values, empty, locale, bars=false }: { title:string; unit:string; values:{label:string;value:number}[]; empty:boolean; locale:'zh'|'en'; bars?:boolean }) {
  const [selected,setSelected] = useState(0); const index=Math.min(selected,Math.max(0,values.length-1));
  const max=Math.max(1,...values.map(point=>point.value));
  const x=(i:number)=>values.length===1?300:32+i*536/(values.length-1); const y=(value:number)=>168-value/max*132;
  return <article className="analytics-card"><header><h3>{title}</h3><span>{unit}</span></header>
    {empty || !values.length ? <div className="analytics-empty"><AppIcon name="progress"/><p>{locale==='zh'?'尚无可分析的已完成记录。':'no completed records to analyse yet.'}</p><Link to="/workout">{locale==='zh'?'查看训练入口':'open workouts'}</Link></div> : <>
      <svg className="analytics-chart" viewBox="0 0 600 210" role="img" aria-label={`${title} · ${unit}`}>
        {[0,.5,1].map(ratio=><g key={ratio}><path d={`M32 ${y(max*ratio)}H568`} className="analytics-grid-line"/><text x="30" y={y(max*ratio)-7}>{Math.round(max*ratio*10)/10}</text></g>)}
        {bars ? values.map((point,i)=><rect key={point.label} x={x(i)-Math.min(20,180/values.length)} y={y(point.value)} width={Math.min(40,360/values.length)} height={168-y(point.value)} className="analytics-bar"/>) : <polyline points={values.map((point,i)=>`${x(i)},${y(point.value)}`).join(' ')} fill="none" className="analytics-line"/>}
        {values.map((point,i)=><g key={point.label} role="button" tabIndex={0} aria-label={`${point.label}: ${point.value} ${unit}`} onMouseEnter={()=>setSelected(i)} onClick={()=>setSelected(i)} onKeyDown={event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();setSelected(i);}}}><circle cx={x(i)} cy={y(point.value)} r="14" fill="transparent"/><circle cx={x(i)} cy={y(point.value)} r={i===index?5:3} className="analytics-point"/><title>{point.label}: {point.value} {unit}</title></g>)}
        <text x="32" y="199">{values[0].label}</text><text x="568" y="199" textAnchor="end">{values.at(-1)!.label}</text>
      </svg>
      <label className="analytics-point-picker">{locale==='zh'?'查看月份':'inspect month'}<select value={index} onChange={event=>setSelected(Number(event.target.value))}>{values.map((point,i)=><option key={point.label} value={i}>{point.label}</option>)}</select></label>
      <p aria-live="polite">{values[index].label} · {values[index].value.toLocaleString(locale,{maximumFractionDigits:1})} {unit}</p>
      <details><summary>{locale==='zh'?'查看图表数据':'view chart data'}</summary><table><caption>{title} · {unit}</caption><tbody>{values.map(point=><tr key={point.label}><th scope="row">{point.label}</th><td>{point.value.toLocaleString(locale,{maximumFractionDigits:1})}</td></tr>)}</tbody></table></details>
    </>}
  </article>;
}

export function TrainingAnalytics({locale,today,timeZone}:{locale:'zh'|'en';today:string;timeZone:string}) {
  const zh=locale==='zh'; const t=(cn:string,en:string)=>zh?cn:en;
  const [range,setRange]=useState('180'); const [report,setReport]=useState<ProgressReport>(); const [error,setError]=useState('');
  const from=useMemo(()=>{if(range==='all')return '1970-01-01';const date=new Date(`${today}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-Number(range)+1);return date.toISOString().slice(0,10);},[today,range]);
  useEffect(()=>{setReport(undefined);setError('');const subscription=liveQuery(()=>progressService.queryProgress({from,to:today,timeZone},Date.now())).subscribe({next:setReport,error:reason=>setError(String(reason))});return()=>subscription.unsubscribe();},[from,today,timeZone]);
  const summary=useMemo(()=>report?summarizeAnalytics(report):undefined,[report]);
  const top=useMemo(()=>{const results=new Map<string,{name:string;reps:number}>();for(const point of report?.exerciseTrends??[]){const row=results.get(point.exerciseId)??{name:point.name[locale],reps:0};row.reps+=point.reps;results.set(point.exerciseId,row);}return [...results.values()].filter(row=>row.reps>0).sort((a,b)=>b.reps-a.reps).slice(0,5);},[report,locale]);
  const effectiveFrom=range==='all'?(report?.history.at(-1)?.localDate??today):from;
  const weeks=Math.max(1,(Date.parse(today)-Date.parse(effectiveFrom))/86400000+1)/7;
  const format=(value:number)=>value.toLocaleString(locale,{maximumFractionDigits:1});
  const metrics=report&&summary?[
    [t('训练天数','training days'),String(summary.days),t('按实际训练日期去重','distinct actual training dates')],
    [t('完成训练','completed workouts'),String(report.history.length),t('仅统计已完成训练','completed sessions only')],
    [t('实际训练量','recorded volume'),summary.hasVolume?`${format(report.totals.volumeGrams/1000)} kg·${t('次','reps')}`:'—',t('已完成组的负重 × 次数','load × reps from completed sets')],
    [t('记录时长','recorded duration'),summary.hasDuration?`${format(report.totals.durationSeconds/60)} min`:'—',t('仅计时类组，不是全程时长','timed sets, not elapsed workout time')],
    [t('平均周频率','weekly frequency'),`${format(report.history.length/weeks)} / ${t('周','week')}`,t('所选区间内完成次数／周数','completed sessions / weeks in range')],
    [t('已记录动作','recorded exercises'),String(summary.exerciseCount),t('有完成组的不同动作','distinct exercises with completed sets')],
  ]:[];
  return <section className="training-analytics" aria-label={t('训练数据总览','training analytics')}>
    <header className="analytics-heading"><div><h1>{t('训练总览','training overview')}</h1><p>{t('了解你的节奏，看见每一次积累。','your training rhythm, over time.')}</p></div><span className="fitness-sticker">{t('本地记录','LOCAL DATA')}</span></header>
    <div className="analytics-filters"><div role="group" aria-label={t('分析时间范围','analysis period')}>{[['30','30D'],['90','90D'],['180','180D'],['365','1Y'],['all',t('全部','all')]].map(([value,label])=><button key={value} aria-pressed={range===value} onClick={()=>setRange(value)}>{label}</button>)}</div><p>{range==='all'&&!report?.history.length?t('全部记录','all records'):`${effectiveFrom} — ${today}`}</p></div>
    <p className="analytics-caption">{t('按训练记录中的实际日期统计，包含计划与临时训练。图表展示有完成训练的月份。','by recorded actual training date, including planned and temporary workouts. charts show months with completed sessions.')}</p>
    {error?<p role="alert"><StatusIcon status="warning"/>{t('无法读取分析数据：','unable to load analytics: ')}{error}</p>:!report?<div className="analytics-skeleton" role="status">{t('正在读取训练记录…','loading training records…')}</div>:<>
      <div className="analytics-kpis">{metrics.map(([label,value,note])=><article key={label} className="analytics-card"><h3>{label}</h3><strong>{value}</strong><p>{note}</p></article>)}</div>
      <div className="analytics-charts" id="analytics-trends">
        <AnalyticsChart title={t('训练频率','training frequency')} unit={t('完成次数／月','completed workouts / month')} locale={locale} values={summary!.months.map(row=>({label:row.month,value:row.workouts}))} empty={!report.history.length}/>
        <AnalyticsChart title={t('训练量趋势','training volume')} unit={t('kg·次','kg·reps')} locale={locale} values={summary!.months.map(row=>({label:row.month,value:row.volume}))} empty={!summary!.hasVolume}/>
        <div className="analytics-wide" id="analytics-load"><AnalyticsChart title={t('已记录训练时长','recorded training duration')} unit="min" bars locale={locale} values={summary!.months.map(row=>({label:row.month,value:row.seconds/60}))} empty={!summary!.hasDuration}/></div>
        <article className="analytics-card"><h3>{t('动作记录 · 按累计次数','exercise records · by repetitions')}</h3>{top.length?<ol className="analytics-exercises">{top.map(row=><li key={row.name}><span>{row.name}</span><span>{format(row.reps)} {t('次','reps')}</span></li>)}</ol>:<p>{t('暂无已完成的计次类动作。','no completed repetition-based exercises yet.')}</p>}<Link to="/progress">{t('查看完整分析与历史','open detailed progress and history')}</Link></article>
        <article className="analytics-card analytics-reserved"><h3>{t('更多分析','more analysis')}</h3><p>{t('肌群分布、力量估算与个人纪录尚未开放。这里保留后续分析位置。','muscle distribution, strength estimates and personal records are not available yet. this space is reserved for future analysis.')}</p></article>
      </div>
    </>}
  </section>;
}
