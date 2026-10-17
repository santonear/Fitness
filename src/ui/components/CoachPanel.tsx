import {AssistantPanel} from './AssistantPanel';
import {useFeature} from '../useFeature';
import {useAccessStatus} from '../useAccessStatus';
import {accessCopy} from '../../application/ai-access';
import type {EnginePlan} from '../../engine/contracts';
import type {RefObject} from 'react';
import type {SessionTemplate} from '../../domain/v8/contracts';
import type {CoachRequest,CoachResponse} from '../../coach/contracts';
export type CoachApplication = { enginePlan?:EnginePlan; request: CoachRequest; response: CoachResponse; expectedRevision: number };
export type CoachPanelProps = { beforeSend?:(request:CoachRequest)=>Promise<void>; onPreferencesChanged?:()=>Promise<void>; resolveRequest?:(message:string,request:CoachRequest)=>CoachRequest|undefined; rememberOnApply?:boolean; open: boolean; localOnly?: boolean; applyLabel?: string; successLabel?: string; disableNutrition?: boolean; localFallbackOnError?: boolean; templateMinutes?: (template: SessionTemplate) => number; onClose: () => void; request?: CoachRequest; expectedRevision: number;
  initialSend?:{nonce:string;message:string;request:CoachRequest;expectedRevision:number};
  triggerRef?: RefObject<HTMLElement|null>; onLocalPlan?:()=>void; onLocalReview?:()=>void; locale?:'zh'|'en'; unavailableReason?:string; onApply: (candidate: CoachApplication) => Promise<unknown>; onResponse?: (candidate: CoachApplication) => void };

export function CoachPanel(props:CoachPanelProps){
 const enabled=useFeature('aiAssistantV2'),access=useAccessStatus(props.open),locale=props.locale??props.request?.locale??'zh';
 const invalid=access.status&&(access.status.qualification!=='active'||!access.status.sessionValid),disabled=access.status?.aiEnabled===false;
 const reason=props.unavailableReason??(invalid?accessCopy[locale].reasons.invalid:!enabled||disabled?accessCopy[locale].reasons.disabled:undefined);
 return <AssistantPanel {...props} unavailableReason={reason} localOnly={props.localOnly||!enabled||!!invalid||disabled}/>;
}

import {EQUIPMENT,equipmentLabel} from '../../catalog/taxonomy';
import {exercises} from '../../catalog/exercises';
import {lifestyleCopy} from '../../i18n/features/settings/lifestyle';
import {displayTimeZone,instructionRepeatsLatestMessage} from '../../coach/disclosure-format';
import {coachScopeFields} from '../../coach/consent';
import zh from '../../i18n/features/coach/zh.json';
import en from '../../i18n/features/coach/en.json';
function readable(value:unknown,copy:typeof zh,locale:'zh'|'en'):string{
 if(value===true)return copy.yes;if(value===false)return copy.no;if(value===null||value===undefined)return copy.empty;
 if(Array.isArray(value))return value.length?value.map(v=>readable(v,copy,locale)).join('；'):copy.empty;
 if(typeof value==='object')return Object.entries(value).filter(([key,v])=>(key!=='loadGrams'||(typeof v==='number'&&v>0))&&!['id','metricType','requestId','conversationId','planVersionId','workoutId','restoreGeneration','inputSnapshot','planId','versionId','templateId','basedOnVersionId','revision'].includes(key)).map(([key,v])=>`${copy.detailLabels[key as keyof typeof copy.detailLabels]??copy.fields[key as keyof typeof copy.fields]??''}${key in copy.detailLabels||key in copy.fields?'：':''}${readable(key==='loadGrams'&&typeof v==='number'?v/1000:v,copy,locale)}`).join('；');
 if(typeof value==='string'&&(EQUIPMENT as readonly string[]).includes(value))return equipmentLabel(value,locale);
 if(typeof value==='string')return exercises.find(e=>e.id===value)?.name[locale]??copy.values[value as keyof typeof copy.values]??value;
 return String(value);
}
export function CoachScopeDisclosure({request,locale}:{request:CoachRequest;locale:'zh'|'en'}){
 const t=locale==='en'?en:zh,lang=locale==='en'?1:0;
 return <details><summary>{t.scope}</summary><p>{t.consent}</p><p>{t.taskNames[request.task]}</p><dl>{Object.entries(request).filter(([key])=>['locale','timeZone','adultConfirmed','profile','body','history','nutrition','messages','template','instruction','plan','kind','facts'].includes(key)).map(([key,value])=><div key={key}><dt>{key==='nutrition'?lifestyleCopy[locale].nutrition:t.fields[key as keyof typeof t.fields]}</dt><dd>{key==='timeZone'?displayTimeZone(String(value),locale):key==='instruction'&&instructionRepeatsLatestMessage(request)?t.sameAsMessage:readable(value,t,lang?'en':'zh')}</dd></div>)}</dl><details><summary>{t.technical}</summary><dl>{coachScopeFields(request).map(field=><div key={field.key}><dt>{t.fields[field.key as keyof typeof t.fields]??field.key}</dt><dd>{field.value}</dd></div>)}</dl></details></details>;
}
