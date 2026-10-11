import {useEffect,useState} from 'react';
import {adminRequest} from '../shared/api';
import type {FinanceLanguage} from './copy';
import './status-overview.css';
interface StatusData {
 aiEnabled?:boolean;
 ledger?:{settledFen:number;pendingFen:number};
 config?:{current:{config:{monthlyBudgetFen:number}}};
 todos?:{items:{id:string}[]};
 errors?:{groups:{spike:boolean;trend:{time:number;count:number}[]}[]};
}
const copy={zh:{title:'系统状态',ai:'AI 开关',ledger:'账本',remaining:'本月剩余预算',pending:'待核算预留',errors:'24 小时错误',unavailable:'状态不可用',enabled:'开启',disabled:'关闭',aiNote:'开关不代表模型可用',review:'需要核对',clear:'当前无核对待办',ledgerNote:'调用是否可用以当前准入状态为准',limit:'上限',reserved:'预留不是实际费用',spike:'出现突增',noSpike:'当前无突增',recorded:'仅统计已收到的错误报告',loading:'正在读取',unknown:'数据暂未取得'},en:{title:'System status',ai:'AI switch',ledger:'Ledger',remaining:'Budget remaining',pending:'Pending reservations',errors:'Errors in 24 hours',unavailable:'Unavailable',enabled:'On',disabled:'Off',aiNote:'The switch does not confirm model availability',review:'Review needed',clear:'No reconciliation task',ledgerNote:'Request availability follows current admission rules',limit:'Limit',reserved:'Reservations are not actual charges',spike:'Spike detected',noSpike:'No current spike',recorded:'Counts received error reports only',loading:'Loading',unknown:'Data is not available'}};
export function statusCards(data:StatusData,language:FinanceLanguage){
 const t=copy[language],money=(n:number)=>`¥ ${(n/100).toFixed(2)}`;
 const review=data.todos?.items.some(i=>i.id==='finance-ledger-reconciliation');
 const errorCount=data.errors?.groups.reduce((sum,g)=>sum+g.trend.reduce((n,b)=>n+b.count,0),0),spike=data.errors?.groups.some(g=>g.spike);
 const budget=data.config?.current.config.monthlyBudgetFen,remaining=budget!==undefined&&data.ledger?Math.max(0,budget-data.ledger.settledFen-data.ledger.pendingFen):undefined;
 return [
  {id:'ai',label:t.ai,value:data.aiEnabled===undefined?t.unavailable:data.aiEnabled?t.enabled:t.disabled,note:t.aiNote,status:data.aiEnabled===undefined?'unknown':data.aiEnabled?'ok':'warn'},
  {id:'ledger',label:t.ledger,value:review===undefined?t.unavailable:review?t.review:t.clear,note:t.ledgerNote,status:review===undefined?'unknown':review?'alert':'ok'},
  {id:'budget',label:t.remaining,value:remaining===undefined?t.unavailable:money(remaining),note:budget===undefined?t.unknown:`${t.limit} ${money(budget)}`,status:remaining===undefined?'unknown':remaining===0?'alert':'ok'},
  {id:'pending',label:t.pending,value:data.ledger?money(data.ledger.pendingFen):t.unavailable,note:t.reserved,status:!data.ledger?'unknown':data.ledger.pendingFen>0?'warn':'ok'},
  {id:'errors',label:t.errors,value:errorCount===undefined?t.unavailable:String(errorCount),note:errorCount===undefined?t.unknown:`${spike?t.spike:t.noSpike} · ${t.recorded}`,status:errorCount===undefined?'unknown':spike?'alert':'ok'},
 ];
}
/** aiEnabled must come from the control ledger, never the aiOperations monitoring flag. */
export function StatusOverview({language='zh',aiEnabled}:{language?:FinanceLanguage;aiEnabled?:boolean}){
 const[data,setData]=useState<StatusData>({}),[loading,setLoading]=useState(true);
 useEffect(()=>{let active=true;const month=new Date().toISOString().slice(0,7);void Promise.allSettled([adminRequest<StatusData['ledger']>(`finance/ledger?month=${month}`),adminRequest<StatusData['config']>('finance/config'),adminRequest<StatusData['todos']>('todos'),adminRequest<StatusData['errors']>('quality/errors'),adminRequest<{aiEnabled:boolean;recoveryRequired:boolean}>('users/status')]).then(([ledger,config,todos,errors,control])=>{if(!active)return;setData({aiEnabled:control.status==='fulfilled'?control.value.aiEnabled:undefined,ledger:ledger.status==='fulfilled'?ledger.value:undefined,config:config.status==='fulfilled'?config.value:undefined,todos:todos.status==='fulfilled'?todos.value:undefined,errors:errors.status==='fulfilled'?errors.value:undefined});setLoading(false)});return()=>{active=false}},[]);
 return <section className="finance-status-overview" aria-label={copy[language].title} aria-busy={loading}>{statusCards({...data,aiEnabled:aiEnabled??data.aiEnabled},language).map(c=><article className="finance-status-item" key={c.id} data-status={c.status}><h2>{c.label}</h2><strong>{loading&&c.id!=='ai'?copy[language].loading:c.value}</strong><p>{c.note}</p></article>)}</section>;
}

