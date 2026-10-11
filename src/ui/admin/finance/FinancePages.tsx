import {formatAdminTimeZone} from '../time-zone';
import { useEffect,useState } from 'react';
import { adminRequest,useAdminAction,reverifyAdmin } from '../shared/api';
import { AdminDialog,AdminToast } from '../shared/components';
import { runtimeSchema,validateAnnouncement,type RuntimeConfig,type ConfigVersion,type Announcement } from '../../../backend/admin/finance/runtime';
import type { ledgerProjection } from '../../../backend/admin/finance/report';
import { financeCopy,financeLabel,type FinanceLanguage } from './copy';
import {CostChart} from './CostChart';
import {isMoneyField,yuanToFen,configDisplay,localDateInput,parseLocalDateInput,filterTaskCosts} from './display-values';
import {TaskCostChart} from './TaskCostChart';
import {configReview,canDismissBudget} from './config-review';
import {financeOutcome,mutationCopy} from './outcome';
type Ledger=ReturnType<typeof ledgerProjection>;
function useData<T>(path:string){const[value,setValue]=useState<T>();const[error,setError]=useState(false);const[revision,setRevision]=useState(0);useEffect(()=>{let alive=true;setValue(undefined);setError(false);adminRequest<T>(path).then(v=>{if(alive)setValue(v)}).catch(()=>{if(alive)setError(true)});return()=>{alive=false}},[path,revision]);return{value,error,refresh:()=>setRevision(x=>x+1)}}
const money=(fen:number)=>`¥ ${(fen/100).toFixed(2)}`;
type Pending={path:string;body:unknown;id:ReturnType<typeof crypto.randomUUID>};
function useMutation(key:string,language:FinanceLanguage){
 const action=useAdminAction(),[pending,setPending]=useState<Pending|undefined>(()=>{try{return JSON.parse(sessionStorage.getItem(key)??'null')??undefined}catch{return undefined}});
 const[freshRequired,setFreshRequired]=useState(false);
 async function execute(p:Pending){
  setPending(p);sessionStorage.setItem(key,JSON.stringify(p));let outcome:'reverify'|'rejected'|'unknown'='unknown';
  const ok=await action.run(async()=>{try{return await adminRequest(p.path,p.body,p.id)}catch(e){outcome=financeOutcome(e);throw e}});
  if(ok||String(outcome)==='rejected'){setPending(undefined);sessionStorage.removeItem(key)}
  setFreshRequired(!ok&&String(outcome)==='reverify');action.setMessage(mutationCopy[language][ok?'success':outcome]);return ok;
 }
 return{...action,pending,execute,freshRequired};
}
export function FinanceLedger({language='zh'}:{language?:FinanceLanguage}){
 const t=financeCopy[language], [selectedMonth,setMonth]=useState(''), data=useData<Ledger>(selectedMonth?`finance/ledger?month=${selectedMonth}`:'finance/ledger'),config=useData<{current:ConfigVersion;dismissedBudgetMonths:string[]}>('finance/config');
 const month=selectedMonth||data.value?.month||'';
 const[row,setRow]=useState<Ledger['rows'][number]>(),[amount,setAmount]=useState(''),mutation=useMutation('finance-ledger-pending',language);
 async function settle(){if(!row||!/^\d+$/.test(amount))return;const ok=await mutation.execute({path:'finance/settle',body:{subjectShortId:row.subjectShortId,requestShortId:row.requestShortId,actualCost:Number(amount)},id:crypto.randomUUID()});if(ok){setRow(undefined);data.refresh();config.refresh()}}
 return <><h2>{t.ledger}</h2><div className="admin-actions"><label>{t.month}<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><a href={`/api/v1/management/console/finance/export${month?'?month='+encodeURIComponent(month):''}`}>{t.export}</a></div>{data.error?<p role="alert">{t.unavailable}</p>:!data.value?<p role="status">{t.loading}</p>:<><section className="admin-card"><p>{t.settled} <strong>{money(data.value.settledFen)}</strong></p><p>{t.pending} <strong>{money(data.value.pendingFen)}</strong></p><p>{t.unattributed} {money(data.value.unattributedFen)}</p>{config.value&&<><label>{t.budget} {money(config.value.current.config.monthlyBudgetFen)}<progress aria-label={t.progress} max={config.value.current.config.monthlyBudgetFen} value={data.value.settledFen+data.value.pendingFen}/></label><small>{t.progress}</small>{canDismissBudget(data.value.settledFen,data.value.pendingFen,config.value.current.config.monthlyBudgetFen,config.value.dismissedBudgetMonths?.includes(month)??false)&&<button disabled={mutation.busy||!!mutation.pending} onClick={()=>void mutation.execute({path:"finance/dismiss-budget",body:{month},id:crypto.randomUUID()}).then(ok=>{if(ok)config.refresh()})}>{language==="zh"?"关闭本月 50% 预算提示":"Dismiss monthly 50% reminder"}</button>}</>}</section><section className="admin-card admin-scroll"><table><thead><tr>{[t.user,t.task,t.status,t.settled,t.pending,t.reconcile].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{data.value.rows.map(r=><tr key={r.requestShortId+r.subjectShortId}><td>{r.subjectShortId}<br/><small>{r.requestShortId}</small></td><td>{financeLabel(r.operation,language)}</td><td>{financeLabel(r.status,language)}</td><td>{money(r.settledFen)}</td><td>{money(r.reservedFen)}</td><td>{['pending','submitted'].includes(r.status)&&<button disabled={!!mutation.pending} onClick={()=>{setRow(r);setAmount('')}}>{t.reconcile}</button>}</td></tr>)}</tbody></table>{!data.value.rows.length&&<p>{t.empty}</p>}</section></>}
 <AdminDialog open={!!row&&!mutation.pending} title={t.reconcile} onClose={()=>setRow(undefined)} onConfirm={()=>void settle()} confirmLabel={t.confirm} busy={mutation.busy}><p>{t.settleImpact}</p><p>{row?.requestShortId}</p><label>{t.amount}<input type="number" min="0" step="1" value={amount} onChange={e=>setAmount(e.target.value)}/></label></AdminDialog>
 {mutation.freshRequired&&<button onClick={reverifyAdmin}>{t.verify}</button>}{mutation.pending&&<button disabled={mutation.busy} onClick={()=>void mutation.execute(mutation.pending!).then(ok=>{if(ok){setRow(undefined);data.refresh();config.refresh()}})}>{t.retry}</button>}<AdminToast message={mutation.message}/></>;
}
export function FinanceCosts({language='zh'}:{language?:FinanceLanguage}){
 const [task,setTask]=useState('');
 const t=financeCopy[language],[month,setMonth]=useState(new Date().toISOString().slice(0,7));
 const data=useData<{rows:{day:string;task:string;calls:number;settledFen:number;pendingFen:number;fallbacks:number;firstAt:number;lastAt:number}[]}>(`finance/costs?month=${month}`);
 return <section className="admin-card"><h2>{t.costs}</h2><p className="admin-muted">{formatAdminTimeZone("UTC",language)}</p><label>{t.month}<input type="month" value={month} onChange={e=>setMonth(e.target.value)}/></label><p className="admin-muted">{t.legacy}</p>{data.error?<p role="alert">{t.unavailable}</p>:!data.value?<p>{t.loading}</p>:<div className="admin-scroll"><label>{t.task}<select value={task} onChange={e=>setTask(e.target.value)}><option value="">{language==="zh"?"全部任务":"All tasks"}</option>{[...new Set(data.value.rows.map(r=>r.task))].sort().map(value=><option key={value} value={value}>{financeLabel(value,language)}</option>)}</select></label><CostChart rows={filterTaskCosts(data.value.rows,task)} language={language}/><TaskCostChart rows={filterTaskCosts(data.value.rows,task)} language={language}/><table><thead><tr>{[t.day,t.task,t.calls,t.settled,t.pending,t.fallback].map(x=><th key={x}>{x}</th>)}</tr></thead><tbody>{filterTaskCosts(data.value.rows,task).map(r=><tr key={r.day+r.task}><td>{r.day}</td><td>{financeLabel(r.task,language)}</td><td>{r.calls}</td><td>{money(r.settledFen)}</td><td>{money(r.pendingFen)}</td><td>{r.fallbacks}{r.fallbacks>0&&<small> {new Date(r.firstAt).toLocaleTimeString(language==="zh"?"zh-CN":"en",{timeZone:"UTC"})}–{new Date(r.lastAt).toLocaleTimeString(language==="zh"?"zh-CN":"en",{timeZone:"UTC"})}</small>}</td></tr>)}</tbody></table>{!data.value.rows.length&&<p>{t.empty}</p>}</div>}</section>;
}
export function FinanceSettings({language='zh'}:{language?:FinanceLanguage}){
 const t=financeCopy[language],data=useData<{current:ConfigVersion;history:ConfigVersion[];defaults:RuntimeConfig}>('finance/config'),notice=useData<{announcement:Announcement|null}>('finance/announcement'),mutation=useMutation('finance-settings-pending',language);
 const[draft,setDraft]=useState<RuntimeConfig>(),[review,setReview]=useState<Pending>(),[announcement,setAnnouncement]=useState<Announcement>({text:'芽芽暂时休息，训练和记录不受影响。',start:Date.now(),end:Date.now()+86400000});
 useEffect(()=>{if(data.value)setDraft(data.value.current.config)},[data.value]);useEffect(()=>{if(notice.value?.announcement)setAnnouncement(notice.value.announcement)},[notice.value]);
 function queue(path:string,body:unknown){try{if(path.endsWith("config")&&(body as {config?:RuntimeConfig}).config)runtimeSchema.parse((body as {config:RuntimeConfig}).config);if(path.endsWith("announcement")&&(body as {announcement:Announcement|null}).announcement)validateAnnouncement((body as {announcement:Announcement}).announcement);setReview({path,body,id:crypto.randomUUID()})}catch{mutation.setMessage(language==="zh"?"请检查数值范围、公告时间和用语。":"Check value ranges, notice dates and wording.")}}
 async function commit(p:Pending){const ok=await mutation.execute(p);setReview(undefined);data.refresh();if(ok)notice.refresh()}
 return <><section className="admin-card"><h2>{t.settings}</h2><p>{t.impact}</p>{data.error?<p role="alert">{t.unavailable}</p>:!draft?<p>{t.loading}</p>:<><fieldset disabled={mutation.busy||!!mutation.pending}>{(Object.keys(draft) as (keyof RuntimeConfig)[]).map(k=><label key={k}>{t[k]}<input type="number" step={isMoneyField(k)?"0.01":"1"} min="0" value={isMoneyField(k)?(draft[k]??0)/100:draft[k]} onChange={e=>{const value=isMoneyField(k)?yuanToFen(e.target.value):Number(e.target.value);if(value!==undefined)setDraft({...draft,[k]:value})}}/></label>)}<button className="primary" onClick={()=>queue('finance/config',{expectedVersion:data.value!.current.version,config:draft})}>{t.save}</button><button onClick={()=>queue('finance/config',{expectedVersion:data.value!.current.version,restoreVersion:0})}>{t.defaults}</button></fieldset><h3>{t.history}</h3>{data.value?.history.map(v=><p key={v.version}>{t.version} {v.version} · {new Date(v.at).toLocaleString()} <button disabled={!!mutation.pending} onClick={()=>queue('finance/config',{expectedVersion:data.value!.current.version,restoreVersion:v.version})}>{t.restore}</button></p>)}</>}</section>
 <section className="admin-card"><h2>{t.announcement}</h2><p>{t.notice}</p>{notice.error&&<p role="alert">{t.unavailable}</p>}<fieldset disabled={!!mutation.pending||notice.error}><label>{t.text}<input maxLength={160} value={announcement.text} onChange={e=>setAnnouncement({...announcement,text:e.target.value})}/></label>{(['start','end'] as const).map(k=><label key={k}>{t[k]} ({formatAdminTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone,language,announcement[k])})<input type="datetime-local" value={localDateInput(announcement[k])} onChange={e=>{const n=parseLocalDateInput(e.target.value);if(n!==undefined)setAnnouncement({...announcement,[k]:n})}}/><small>{formatAdminTimeZone("UTC",language)}: {new Date(announcement[k]).toISOString().slice(0,16).replace("T"," ")}</small></label>)}<div className="admin-actions"><button onClick={()=>queue('finance/announcement',{announcement})}>{t.publish}</button><button onClick={()=>queue('finance/announcement',{announcement:null})}>{t.withdraw}</button></div></fieldset></section>
 <AdminDialog open={!!review} title={t.confirm} onClose={()=>setReview(undefined)} onConfirm={()=>review&&void commit(review)} confirmLabel={t.confirm} busy={mutation.busy}><p>{review?.path.endsWith('config')?t.impact:t.notice}</p>{review?.path.endsWith('config')&&data.value&&<dl>{configReview(data.value.current.config,(review.body as {config?:RuntimeConfig}).config??((review.body as {restoreVersion:number}).restoreVersion===0?data.value.defaults:data.value.history.find(v=>v.version===(review.body as {restoreVersion:number}).restoreVersion)!.config)).map(row=><div key={row.field}><dt>{t[row.field]}</dt><dd>{t.before}: {configDisplay(row.field,row.before)} → {t.after}: {configDisplay(row.field,row.after)}</dd></div>)}</dl>}</AdminDialog>
 {mutation.freshRequired&&<button onClick={reverifyAdmin}>{t.verify}</button>}{mutation.pending&&<button disabled={mutation.busy} onClick={()=>void commit(mutation.pending!)}>{t.retry}</button>}<AdminToast message={mutation.message}/></>;
}











