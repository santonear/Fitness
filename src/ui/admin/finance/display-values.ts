import type {RuntimeConfig} from '../../../backend/admin/finance/runtime';
export const isMoneyField=(key:keyof RuntimeConfig)=>key==='monthlyBudgetFen'||key==='reservationFen';
export function yuanToFen(value:string):number|undefined{
 if(!/^\d+(?:\.\d{0,2})?$/.test(value))return;
 const[whole,fraction='']=value.split('.'),fen=Number(whole)*100+Number(fraction.padEnd(2,'0'));
 return Number.isSafeInteger(fen)?fen:undefined;
}
export function configDisplay(key:keyof RuntimeConfig,value:number|undefined){return value===undefined?'—':isMoneyField(key)?`¥ ${(value/100).toFixed(2)}`:String(value)}
export function localDateInput(timestamp:number){const d=new Date(timestamp),pad=(n:number)=>String(n).padStart(2,'0');return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`}
export function parseLocalDateInput(value:string){const n=new Date(value).getTime();return Number.isFinite(n)&&localDateInput(n)===value?n:undefined}
export function filterTaskCosts<T extends {task:string}>(rows:T[],task:string){return task?rows.filter(row=>row.task===task):rows}
