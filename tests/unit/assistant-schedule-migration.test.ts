import {it,expect} from 'vitest';
import {recoverAssistantSchedule} from '../../src/persistence/assistant-schedule-migration';
import type {PlanVersion} from '../../src/domain/v8/contracts';
import type {AssistantConversation} from '../../src/persistence/assistant-conversations';
const plan=(versionNumber:number,scheduleOriginalText:string):PlanVersion=>({id:String(versionNumber),planId:'plan',versionNumber,goalText:'健身',weeklyTarget:3,sessionMinutes:40,scheduleOriginalText,templates:[],createdAt:'2026-10-12T00:00:00.000Z',origin:'coach_change',changeSummary:[]});
it('restores only an exact assistant user-message collision and preserves the overwritten text',()=>{
 const words='改成周一三五，把阿诺德推举换掉';
 const versions=[plan(1,'每周两次，每次40分钟'),plan(2,words),plan(3,'保持当前安排')];
 const conversations:AssistantConversation[]=[{id:'11111111-1111-4111-8111-111111111111',title:'修改计划',updatedAt:'2026-10-12T00:00:00.000Z',messages:[{role:'user',content:words}]}];
 const fixed=recoverAssistantSchedule(versions,conversations,'2026-10-12T01:00:00.000Z');
 expect(fixed).toEqual([{...versions[1],scheduleOriginalText:versions[0].scheduleOriginalText,scheduleRecovery:{raw:words,recoveredAt:'2026-10-12T01:00:00.000Z'}}]);
 expect(recoverAssistantSchedule([versions[0],fixed[0],versions[2]],conversations,'2026-10-12T02:00:00.000Z')).toEqual([]);
 expect(recoverAssistantSchedule(versions,[], '2026-10-12T01:00:00.000Z')).toEqual([]);
});
