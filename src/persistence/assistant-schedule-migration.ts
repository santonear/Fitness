import type {PlanVersion} from '../domain/v8/contracts';
import type {AssistantConversation} from './assistant-conversations';

type LegacyPlanSchedule = {id:string;currentVersionId:string;scheduleOriginalText?:string;scheduleRecovery?:PlanVersion['scheduleRecovery']};
function userMessages(conversations:readonly AssistantConversation[]):Set<string>{
 return new Set(conversations.flatMap(conversation=>conversation.messages.filter(message=>message.role==='user').map(message=>message.content)));
}
/** Recover from the nearest earlier clean version. A chain with no clean ancestor has an unknown original answer. */
export function recoverAssistantSchedule(versions:readonly PlanVersion[],conversations:readonly AssistantConversation[],recoveredAt:string):PlanVersion[]{
 const messages=userMessages(conversations);
 return versions.flatMap(version=>{
  if(!messages.has(version.scheduleOriginalText))return [];
  const predecessor=versions.filter(other=>other.planId===version.planId&&other.versionNumber<version.versionNumber&&!messages.has(other.scheduleOriginalText))
   .sort((a,b)=>b.versionNumber-a.versionNumber)[0];
  return [{...version,scheduleOriginalText:predecessor?.scheduleOriginalText??'',scheduleRecovery:{raw:version.scheduleRecovery?.raw??version.scheduleOriginalText,recoveredAt}}];
 });
}
/** Older stored plan rows may contain this field although current plan rows keep it on versions only. */
export function recoverLegacyPlanSchedules<T extends LegacyPlanSchedule>(plans:readonly T[],versions:readonly PlanVersion[],conversations:readonly AssistantConversation[],recoveredAt:string):T[]{
 const messages=userMessages(conversations);
 return plans.flatMap(plan=>{
  const raw=plan.scheduleOriginalText;
  if(raw===undefined||!messages.has(raw))return [];
  const currentNumber=versions.find(version=>version.id===plan.currentVersionId)?.versionNumber;
  const predecessor=versions.filter(version=>version.planId===plan.id&&(currentNumber===undefined||version.versionNumber<currentNumber)&&!messages.has(version.scheduleOriginalText))
   .sort((a,b)=>b.versionNumber-a.versionNumber)[0];
  return [{...plan,scheduleOriginalText:predecessor?.scheduleOriginalText??'',scheduleRecovery:{raw:plan.scheduleRecovery?.raw??raw,recoveredAt}}];
 });
}
