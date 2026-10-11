/** Offset is evaluated at the displayed instant, so daylight-saving labels remain accurate. */
export function formatAdminTimeZone(timeZone:string,language:'zh'|'en'='zh',at:number|Date=Date.now()):string {
 const parts=new Intl.DateTimeFormat('en',{timeZone,timeZoneName:'longOffset'}).formatToParts(at),offset=parts.find(p=>p.type==='timeZoneName')!.value.replace('GMT','UTC').replace(/([+-])0(\d)/,'$1$2').replace(':00','');
 if(language==='en')return offset==='UTC'?'UTC+0':offset;
 const match=/^UTC([+-])(\d+)(?::(\d+))?$/.exec(offset),numbers=['零','一','二','三','四','五','六','七','八','九','十','十一','十二','十三','十四'];
 if(!match||(Number(match[2])===0&&!match[3]))return '零时区（UTC+0）';
 if(match[3])return `${timeZone}（${offset}）`;
 return `${match[1]==='+'?'东':'西'}${numbers[Number(match[2])]??match[2]}区（${offset}）`;
}

