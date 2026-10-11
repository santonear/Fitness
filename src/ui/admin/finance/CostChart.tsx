import {financeCopy,type FinanceLanguage} from './copy';
import './finance.css';
export function CostChart({rows,language}:{rows:{day:string;settledFen:number;pendingFen:number}[];language:FinanceLanguage}){
 const t=financeCopy[language],days=new Map<string,{settled:number;pending:number}>();for(const r of rows){const d=days.get(r.day)??{settled:0,pending:0};d.settled+=r.settledFen;d.pending+=r.pendingFen;days.set(r.day,d)}
 const entries=[...days.entries()].sort(([a],[b])=>a.localeCompare(b)),max=Math.max(1,...entries.map(([,v])=>v.settled+v.pending));
 if(!entries.length)return null;
 return <figure className="finance-chart"><figcaption>{t.settled} / {t.pending}</figcaption><div className="admin-scroll"><svg viewBox={`0 0 ${Math.max(entries.length*34,300)} 160`} role="img" aria-label={`${t.costs}: ${entries[0][0]} – ${entries.at(-1)![0]}`}><title>{t.settled} / {t.pending}</title>{entries.map(([day,v],i)=><g key={day}><title>{day}: {t.settled} {v.settled/100}; {t.pending} {v.pending/100}</title><rect className="finance-chart-settled" x={i*34+5} y={130-v.settled/max*110} width="22" height={v.settled/max*110}/><rect className="finance-chart-pending" x={i*34+5} y={130-(v.settled+v.pending)/max*110} width="22" height={v.pending/max*110}/><text x={i*34+16} y="151" textAnchor="middle">{day.slice(-2)}</text></g>)}</svg></div></figure>;
}
