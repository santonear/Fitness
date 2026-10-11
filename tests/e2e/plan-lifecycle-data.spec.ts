import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
const source=JSON.parse(readFileSync(new URL('../fixtures/legacy-backups/pr52-before-plan-delete.json',import.meta.url),'utf8'));
for(const fail of [false,true])test(`DB10 lifecycle upgrade ${fail?'rolls back on failure':'preserves every historical fact'}`,async({page})=>{
 await page.goto('/tests/e2e/helpers/capacity-entry.html');
 const result=await page.evaluate(async({source,fail})=>{
 const load=(p:string)=>import(/* @vite-ignore */p),{Dexie}=await load('/tests/e2e/helpers/cal-browser.ts'),{createDatabase}=await load('/src/persistence/db.ts');
 const schema=createDatabase(`shape-${crypto.randomUUID()}`);await schema.open();const stores=Object.fromEntries(schema.tables.filter((t:any)=>t.name!=='v8PlanReferences').map((t:any)=>[t.name,[t.schema.primKey.src,...t.schema.indexes.map((i:any)=>i.src)].join(',')]));schema.close();await schema.delete();
 const name=`delete-upgrade-${crypto.randomUUID()}`,old=new Dexie(name);old.version(10).stores(stores);await old.open();
 const mapping:Record<string,string>={v8Plans:'plans',v8PlanVersions:'planVersions',v8Workouts:'workouts',v8Activities:'activities',v8State:'state'};
 for(const table of old.tables){const value=mapping[table.name]?source.data.v8[mapping[table.name]]:source.data[table.name];if(value!==undefined)await table.bulkAdd(Array.isArray(value)?value:[value]);}
 const snap=(db:any,omit:string[]=[])=>db.transaction('r',db.tables,async()=>JSON.stringify(await Promise.all(db.tables.filter((t:any)=>!omit.includes(t.name)).sort((a:any,b:any)=>a.name.localeCompare(b.name)).map(async(t:any)=>[t.name,await t.toArray()]))));
 const before=await snap(old),facts=await snap(old,['metadata']);old.close();const db=createDatabase(name);
 try{if(fail)db.metadata.hook('updating',()=>{throw Error('injected upgrade failure');});const rejected=await db.open().then(()=>false,()=>true);
 if(fail){db.close();const check=new Dexie(name);await check.open();const result={rejected,same:before===await snap(check),version:check.verno};check.close();return result;}
 const after=await snap(db);db.close();await db.open();return{rejected,same:facts===await snap(db,['metadata','v8PlanReferences']),version:db.verno,metadata:(await db.metadata.toCollection().first()).schemaVersion,empty:await db.v8PlanReferences.count()===0,idempotent:after===await snap(db)};
 }finally{db.close();await db.delete();}
 },{source,fail});
 expect(result).toEqual(fail?{rejected:true,same:true,version:10}:{rejected:false,same:true,version:11,metadata:11,empty:true,idempotent:true});
});

test('real IndexedDB deletion backup, expiry cleanup and rollback preserve training and review',async({page})=>{
 await page.goto('/tests/e2e/helpers/capacity-entry.html');
 const result=await page.evaluate(async source=>{
 const load=(p:string)=>import(/* @vite-ignore */p),{createDatabase}=await load('/src/persistence/db.ts'),{createRepository}=await load('/src/persistence/repository.ts'),{createProfileService}=await load('/src/application/profile.ts'),{createBackupService}=await load('/src/application/backup.ts'),{createPlanLifecycle,PLAN_RETENTION_MS}=await load('/src/application/plan-lifecycle.ts'),{computeWeekFacts}=await load('/src/application/review/compute.ts');
 const db=createDatabase(`delete-roundtrip-${crypto.randomUUID()}`),repo=createRepository(db),backup=createBackupService(repo);let now=Date.now();const life=createPlanLifecycle(repo,()=>now);
 try{await createProfileService(repo).initialize('zh');
 const restore=async(value:any)=>{const valid=await backup.validateBackup(new File([JSON.stringify(value)],'plans.json'));await backup.importBackup(valid,{backupExported:true,replacementConfirmed:true,expectedRevision:valid.expectedRevision});};
 await restore(source);const plan=(await db.v8Plans.toArray())[0],before=JSON.stringify(await db.v8Workouts.toArray());
 const facts=async()=>computeWeekFacts({from:'2026-10-05',to:'2026-10-11',timeZone:'Asia/Shanghai',weeklyTarget:3,workouts:await db.v8Workouts.toArray(),activities:[],bodyWeights:[]});const previous=JSON.stringify(await facts());
 await life.deletePlan(plan.id,(await repo.readMetadata()).dataRevision);const exported=JSON.parse(await(await backup.exportBackup()).text());await restore(exported);const softRestored=(await db.v8Plans.get(plan.id)).deletedAt===exported.data.v8.plans[0].deletedAt;
 const snap=()=>db.transaction('r',db.tables,async()=>JSON.stringify(await Promise.all(db.tables.map(async(t:any)=>[t.name,await t.toArray()]))));
 now=Date.parse(exported.data.v8.plans[0].deletedAt)+PLAN_RETENTION_MS;
 const saved=await snap(),reject=()=>{throw Error('injected cleanup failure');};db.v8Plans.hook('deleting',reject);const failed=await life.purgeExpiredPlans().then(()=>false,()=>true);db.v8Plans.hook('deleting').unsubscribe(reject);const rolledBack=saved===await snap();
 const count=await life.purgeExpiredPlans(),after=await snap();const again=await life.purgeExpiredPlans();const idempotent=after===await snap();
 const cleaned=JSON.parse(await(await backup.exportBackup()).text());await restore(cleaned);
 return{softRestored,failed,rolledBack,count,again,idempotent,envelope:cleaned.schemaVersion,plans:await db.v8Plans.count(),versions:await db.v8PlanVersions.count(),references:await db.v8PlanReferences.count(),sameWorkouts:before===JSON.stringify(await db.v8Workouts.toArray()),sameFacts:previous===JSON.stringify(await facts())};
 }finally{db.close();await db.delete();}
 },source);
 expect(result).toEqual({softRestored:true,failed:true,rolledBack:true,count:1,again:0,idempotent:true,envelope:9,plans:0,versions:0,references:1,sameWorkouts:true,sameFacts:true});
});
