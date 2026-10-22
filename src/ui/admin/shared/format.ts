import { DAY_MS } from '../../../domain/local-date';
/** Operator-facing date and money formatting shared by admin tables. */
export function adminDate(timestamp:number|null|undefined,zh:boolean,now=Date.now()){
 if(timestamp===null||timestamp===undefined||!Number.isFinite(timestamp))return zh?'未记录':'Not recorded';
 const locale=zh?'zh-CN':'en-US',day=(t:number)=>new Date(t).toDateString();
 const time=new Intl.DateTimeFormat(locale,{hour:'2-digit',minute:'2-digit',hour12:false}).format(timestamp);
 if(day(timestamp)===day(now))return zh?`今天 ${time}`:`Today ${time}`;
 if(day(timestamp)===day(now-DAY_MS))return zh?`昨天 ${time}`:`Yesterday ${time}`;
 const sameYear=new Date(timestamp).getFullYear()===new Date(now).getFullYear();
 return new Intl.DateTimeFormat(locale,{...(sameYear?{}:{year:'numeric'}),month:zh?'numeric':'short',day:'numeric'}).format(timestamp);
}
export function adminMoney(fen:number,unknown=false,zh=true){
 const value=`¥${(fen/100).toFixed(2)}`;
 return unknown?`${value} ${zh?'+ 部分未计价':'+ some unpriced'}`:value;
}
