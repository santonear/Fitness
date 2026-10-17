import rules from '../engine/generated/rules-runtime.json';
type Copy={zh:string;en:string};
const copies:Record<string,Copy>=rules.copy;
export function engineCopy(key:string,locale:'zh'|'en'){return copies[key]?.[locale]??'';}
export function engineCopyList(prefix:string,locale:'zh'|'en'){
 return Object.keys(copies).filter(key=>key.startsWith(prefix+'.')).sort((a,b)=>Number(a.split('.').at(-1))-Number(b.split('.').at(-1))).map(key=>({key,text:copies[key][locale]}));
}
export function screeningExpired(completedAt:string|undefined,now=new Date()){
 if(!completedAt)return true;
 const rule=rules.rules.find(row=>row.id==='safety.rescreen.interval') as {value:{interval_months:number}}|undefined;
 if(!rule) return true;
 const expires=new Date(completedAt);expires.setUTCMonth(expires.getUTCMonth()+rule.value.interval_months);
 return !Number.isFinite(expires.getTime())||expires<=now;
}
