import type {PlanVersion} from '../domain/v8/contracts';
import type {AssistantConversation} from './assistant-conversations';

/** Restores only an exact chat-message collision; the overwritten value remains archived. */
export function recoverAssistantSchedule(versions:readonly PlanVersion[],conversations:readonly AssistantConversation[],recoveredAt:string){
 const userMessages=new Set(conversations.flatMap(conversation=>conversation.messages.filter(message=>message.role==='user').map(message=>message.content)));
 return versions.flatMap(version=>{
  if(version.scheduleRecovery||!userMessages.has(version.scheduleOriginalText))return [];
  const predecessor=versions.filter(other=>other.planId===version.planId&&other.versionNumber<version.versionNumber&&other.scheduleOriginalText!==version.scheduleOriginalText)
   .sort((a,b)=>b.versionNumber-a.versionNumber)[0];
  if(!predecessor)return [];
  return [{...version,scheduleOriginalText:predecessor.scheduleOriginalText,scheduleRecovery:{raw:version.scheduleOriginalText,recoveredAt}}];
 });
}
