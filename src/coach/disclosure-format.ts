import type { CoachRequest } from './contracts';
/** Display only: preserve the original IANA value in the request and raw disclosure. */
export function displayTimeZone(zone:string,locale:'zh'|'en',at:Date=new Date()):string {
 try {
  const offset=new Intl.DateTimeFormat('en',{timeZone:zone,timeZoneName:'longOffset'}).formatToParts(at).find(p=>p.type==='timeZoneName')!.value.replace('GMT','UTC');
  const match=offset.match(/^UTC([+-])(\d{2}):(\d{2})$/);
  const label=new Intl.DateTimeFormat(locale==='zh'?'zh-CN':'en',{timeZone:zone,timeZoneName:'long'}).formatToParts(at).find(p=>p.type==='timeZoneName')!.value;
  const short=match?`UTC${match[1]}${Number(match[2])}${match[3]==='00'?'':':'+match[3]}`:offset;
  if(locale==='zh'&&match&&match[3]==='00'){
   const numbers=['零','一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四'];
   const hour=Number(match[2]);
   if(numbers[hour])return `${match[1]==='+'?'东':'西'}${numbers[hour]}区（${short}）`;
  }
  return locale==='zh'?`${label}（${short}）`:`${label} (${short})`;
 } catch { return zone; }
}
export function instructionRepeatsLatestMessage(request:CoachRequest):boolean {
 return 'instruction' in request&&request.messages.filter(message=>message.role==='user').at(-1)?.content===request.instruction;
}
