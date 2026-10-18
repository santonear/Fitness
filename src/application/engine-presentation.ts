import type {EngineNotice,GateResult} from '../engine/contracts';
import {engineCopy} from '../coach/engine-copy';

/** Gate copy stays visible even when a legacy backup has more than three notices. */
export function engineDisplayNotices(value:{notices:EngineNotice[];gates?:GateResult[]}):EngineNotice[]{
 const gates=(value.gates??[]).filter(gate=>gate.status!=='pass'&&gate.noticeCode).sort((a,b)=>Number(b.status==='blocked')-Number(a.status==='blocked')).flatMap(gate=>{
  const key=gate.noticeCode!,zh=engineCopy(key,'zh'),en=engineCopy(key,'en');
  return zh&&en?[{code:key,ruleId:gate.ruleId,copyPath:key,severity:gate.status==='blocked'?'stop' as const:'warning' as const,message:{zh,en}}]:[];
 });
 const blockedIds=new Set((value.gates??[]).filter(gate=>gate.status==='blocked').map(gate=>gate.ruleId));
 if(blockedIds.size)return [...gates,...value.notices].filter(notice=>blockedIds.has(notice.ruleId)).filter((notice,index,all)=>all.findIndex(other=>other.message.zh===notice.message.zh&&other.message.en===notice.message.en)===index);
 const seen=new Set<string>();
 const environment=value.notices.filter(notice=>notice.code.startsWith('engine.copy.environment_'));
 return [...gates,...environment,...value.notices].filter(notice=>{const key=notice.message.zh.trim()+'|'+notice.message.en.trim();if(seen.has(key))return false;seen.add(key);return true;}).slice(0,3);
}
