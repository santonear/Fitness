import {expect,test} from '@playwright/test';

test('startup repairs polluted schedule versions once without losing the archived chat text',async({page})=>{
 await page.goto('/');
 const result=await page.evaluate(async()=>{
  const path='/src/persistence/db.ts';
  const {createDatabase}=await import(/* @vite-ignore */ path) as typeof import('../../src/persistence/db');
  const name=`schedule-recovery-${crypto.randomUUID()}`,db=createDatabase(name);
  const planId=crypto.randomUUID(),versionIds=[crypto.randomUUID(),crypto.randomUUID(),crypto.randomUUID()];
  const words=['每周三次，每次40分钟','以后不要农夫行走','把计划里的换掉'];
  const now=new Date().toISOString();
  await db.open();
  await db.metadata.put({localProfileId:crypto.randomUUID(),schemaVersion:14,catalogVersion:1,revision:1,dataRevision:1});
  await db.v8Plans.put({id:planId,currentVersionId:versionIds[2],readOnly:false,name:'训练计划',scheduleOriginalText:words[2]} as never);
  for(let i=0;i<3;i++)await db.v8PlanVersions.put({id:versionIds[i],planId,versionNumber:i+1,goalText:'体能',weeklyTarget:3,sessionMinutes:40,scheduleOriginalText:words[i],templates:[],createdAt:now,origin:'coach_change',changeSummary:[]});
  await db.assistantConversations.put({id:crypto.randomUUID(),title:'修改计划',updatedAt:now,messages:[{role:'user',content:words[1]},{role:'user',content:words[2]}]});
  db.close();
  const reopened=createDatabase(name);await reopened.open();
  const versions=(await reopened.v8PlanVersions.toArray()).sort((a,b)=>a.versionNumber-b.versionNumber);
  const plan=await reopened.v8Plans.get(planId),metadata=await reopened.metadata.toCollection().first();
  reopened.close();
  const again=createDatabase(name);await again.open();
  const unchanged=JSON.stringify(versions)===JSON.stringify((await again.v8PlanVersions.toArray()).sort((a,b)=>a.versionNumber-b.versionNumber));
  again.close();await again.delete();
  return {schedules:versions.map(v=>v.scheduleOriginalText),raw:versions.map(v=>v.scheduleRecovery?.raw??null),planSchedule:(plan as {scheduleOriginalText?:string}|undefined)?.scheduleOriginalText,marked:!!metadata?.assistantScheduleRecoveryV2At,unchanged};
 });
 expect(result).toEqual({schedules:['每周三次，每次40分钟','每周三次，每次40分钟','每周三次，每次40分钟'],raw:[null,'以后不要农夫行走','把计划里的换掉'],planSchedule:'每周三次，每次40分钟',marked:true,unchanged:true});
});
