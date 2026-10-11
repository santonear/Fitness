import {formatAdminTimeZone} from './time-zone';
const cities:[string,string,string][]=[
 ['Asia/Shanghai','上海','Shanghai'],['Europe/Berlin','柏林 · 中欧','Berlin · Central Europe'],
 ['Asia/Tokyo','东京','Tokyo'],['Asia/Hong_Kong','香港','Hong Kong'],['Asia/Singapore','新加坡','Singapore'],
 ['Asia/Kolkata','加尔各答','Kolkata'],['Asia/Dubai','迪拜','Dubai'],['Europe/London','伦敦','London'],
 ['Europe/Paris','巴黎','Paris'],['Europe/Moscow','莫斯科','Moscow'],['America/New_York','纽约','New York'],
 ['America/Chicago','芝加哥','Chicago'],['America/Denver','丹佛','Denver'],['America/Los_Angeles','洛杉矶','Los Angeles'],
 ['America/Sao_Paulo','圣保罗','São Paulo'],['Australia/Sydney','悉尼','Sydney'],['Pacific/Auckland','奥克兰','Auckland'],
 ['Africa/Johannesburg','约翰内斯堡','Johannesburg'],['Atlantic/Reykjavik','雷克雅未克','Reykjavík'],
];
function canonical(zone:string){return new Intl.DateTimeFormat('en',{timeZone:zone}).resolvedOptions().timeZone}
/** Preserve saved identifiers, including aliases, without merging cities by their current offset. */
export function adminTimeZoneOptions(current:string,language:'zh'|'en'='zh',at:number|Date=Date.now()){
 const key=canonical(current);
 const rows=cities.map(([value,zh,en])=>({value:canonical(value)===key?current:value,city:language==='zh'?zh:en}));
 if(!rows.some(row=>row.value===current)){
  const city=key==='UTC'?(language==='zh'?'协调世界时':'Coordinated Universal Time'):
   current.startsWith('Etc/')?(language==='zh'?'固定时差':'Fixed offset'):key.split('/').at(-1)!.replaceAll('_',' ');
  rows.push({value:current,city});
 }
 const seen=new Set<string>();
 return rows.filter(row=>{const value=canonical(row.value);if(seen.has(value))return false;seen.add(value);return true})
  .map(row=>({value:row.value,label:`${row.city} · ${formatAdminTimeZone(row.value,language,at)}`}));
}
