import {useEffect,useState} from 'react';
import {adminRequest} from '../shared/api';
import {CostChart} from './CostChart';
import {financeCopy,type FinanceLanguage} from './copy';
import type {recentCosts} from '../../../backend/admin/finance/report';
export function RecentCosts({language='zh'}:{language?:FinanceLanguage}){
 const[data,setData]=useState<Awaited<ReturnType<typeof recentCosts>>>(),[error,setError]=useState(false),t=financeCopy[language];
 useEffect(()=>{let active=true;adminRequest<Awaited<ReturnType<typeof recentCosts>>>('finance/recent-costs').then(d=>{if(active)setData(d)}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[]);
 return <section className="admin-card"><h2>{language==='zh'?'近 7 天 AI 费用':'AI costs over the last 7 days'}</h2>{error?<p role="alert">{t.unavailable}</p>:!data?<p>{t.loading}</p>:<><p className="admin-muted">{data.start} – {data.end} · UTC</p><CostChart rows={data.rows} language={language}/><div className="admin-scroll"><table><thead><tr>{[t.day,t.settled,t.pending,t.fallback].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{data.rows.map(r=><tr key={r.day}><td>{r.day}</td><td>{(r.settledFen/100).toFixed(2)}</td><td>{(r.pendingFen/100).toFixed(2)}</td><td>{r.fallbacks}</td></tr>)}</tbody></table>{!data.rows.length&&<p>{t.empty}</p>}</div><small>{t.legacy}</small></>}</section>;
}
