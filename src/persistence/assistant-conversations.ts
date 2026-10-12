import {z} from 'zod';
import type {FitnessDatabase} from './db';
export const conversationSchema=z.strictObject({id:z.uuid(),title:z.string().max(80),consent:z.strictObject({body:z.boolean(),history:z.boolean()}).optional(),updatedAt:z.string().datetime(),messages:z.array(z.strictObject({role:z.enum(['user','assistant']),content:z.string().max(16000)}))});
export type AssistantConversation=z.infer<typeof conversationSchema>;
export function conversationStore(db:FitnessDatabase){return {
 list:()=>db.assistantConversations.orderBy('updatedAt').reverse().toArray(),
 remove:(id:string)=>db.assistantConversations.delete(id),
 save:async(row:AssistantConversation)=>{const parsed=conversationSchema.parse(row);await db.transaction('rw',db.assistantConversations,async()=>{await db.assistantConversations.put(parsed);const rows=await db.assistantConversations.orderBy('updatedAt').reverse().primaryKeys();await db.assistantConversations.bulkDelete(rows.slice(30));});},
};}
export const assistantBackupPreference='fitness-assistant-backup';
export function includeAssistantBackup(){try{return localStorage.getItem(assistantBackupPreference)!=='exclude';}catch{return true;}}
