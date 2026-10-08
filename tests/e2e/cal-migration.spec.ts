import { expect, test } from '@playwright/test';
test('version 3 local library upgrades without rewriting old facts; old Dexie can reopen but is not compatible',async({page})=>{
  await page.goto('/');const result=await page.evaluate(async()=>{
    const load=(path:string)=>import(/* @vite-ignore */ path);const {default:Dexie}=await load('/node_modules/.vite/deps/dexie.js');
    const {createDatabase}=await load('/src/persistence/db.ts');const {createRepository}=await load('/src/persistence/repository.ts');
    const {seedCalLibrary}=await load('/tests/e2e/helpers/cal-browser.ts');
    const fixture=createDatabase(`cal-migration-source-${crypto.randomUUID()}`);const repo=createRepository(fixture);const seeded=await seedCalLibrary(repo);const data=JSON.parse(seeded.oldJson).data;fixture.close();await fixture.delete();
    const name=`cal-migration-${crypto.randomUUID()}`;const old=new Dexie(name);
    const stores={profiles:'id',metadata:'localProfileId',bodyWeights:'id,localDate',plans:'id,status,currentVersionId',planVersions:'id,planId,[planId+versionNumber]',sessions:'id,status,localDate,planVersionId',sets:'id,sessionId,[sessionId+exerciseInstanceId]',scheduledWorkouts:'id,planVersionId,scheduledDate,completedSessionId',trainingMemo:'schemaVersion',aiMemoryNotes:'id,memoRevision',timers:'id,sessionId',mediaAssets:'id'};
    old.version(3).stores(stores);await old.open();for(const table of old.tables)await table.bulkAdd(table.name==='metadata'?[data.metadata]:table.name==='trainingMemo'?[data.trainingMemo]:data[table.name]);
    const snapshot=(db:any)=>db.transaction('r',db.tables,async()=>JSON.stringify(await Promise.all(db.tables.filter((table:any)=>table.name!=='coachDevice'&&table.name!=='metadata'&&table.name!=='guidedStates').sort((a:any,b:any)=>a.name.localeCompare(b.name)).map((table:any)=>table.toArray()))));
    const before=await snapshot(old);old.close();const upgraded=createDatabase(name);await upgraded.open();const unchanged=before===await snapshot(upgraded);const version=(await upgraded.metadata.toCollection().first()).schemaVersion;upgraded.close();
    const rollback=new Dexie(name);rollback.version(3).stores(stores);const reopened=await rollback.open().then(()=>true,()=>false);const runtimeVersion=reopened?(await rollback.table('metadata').toCollection().first()).schemaVersion:null;rollback.close();await upgraded.delete();return {unchanged,version,reopened,runtimeVersion};
  });expect(result).toEqual({unchanged:true,version:6,reopened:true,runtimeVersion:6});
});
