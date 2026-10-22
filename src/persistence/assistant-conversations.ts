import {conversationSchema,type AssistantConversation} from '../domain/assistant-conversation';
export {conversationSchema,type AssistantConversation} from '../domain/assistant-conversation';
import type {FitnessDatabase} from './db';
export function conversationStore(db:FitnessDatabase){return {
 list:()=>db.assistantConversations.orderBy('updatedAt').reverse().toArray(),
 remove:(id:string)=>db.assistantConversations.delete(id),
 save:async(row:AssistantConversation)=>{const parsed=conversationSchema.parse(row);await db.transaction('rw',db.assistantConversations,async()=>{await db.assistantConversations.put(parsed);const rows=await db.assistantConversations.orderBy('updatedAt').reverse().primaryKeys();await db.assistantConversations.bulkDelete(rows.slice(30));});},
};}
export const assistantBackupPreference='fitness-assistant-backup';
export function includeAssistantBackup(){try{return localStorage.getItem(assistantBackupPreference)!=='exclude';}catch{return true;}}
