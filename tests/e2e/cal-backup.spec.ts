import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
test('real downloaded day/legacy JSON and pre-restore file independently restore with all facts',async({page,context},info)=>{
  await page.goto('/settings?tab=backup');
  await page.evaluate(async()=>{const p='/tests/e2e/helpers/cal-browser.ts';await(await import(/* @vite-ignore */ p)).seedCalLibrary();});
  const downloading=page.waitForEvent('download');await page.getByRole('button',{name:'Export JSON backup',exact:true}).click();const download=await downloading;const path=info.outputPath('complete-cal.json');await download.saveAs(path);const text=await readFile(path,'utf8');
  const source=JSON.parse(text);expect(source.schemaVersion).toBe(6);expect(source.data.planVersions).toHaveLength(3);expect(source.data.sessions).toHaveLength(3);expect(source.data.bodyWeights).toHaveLength(1);expect(source.data.timers).toHaveLength(1);expect(source.data.aiMemoryNotes).toHaveLength(1);
  const independent=await page.evaluate(async text=>{const p='/tests/e2e/helpers/cal-browser.ts';return(await import(/* @vite-ignore */ p)).verifyIsolatedRestore(text);},text);expect(independent).toEqual({same:true,version:6,metadata:8});
  const destination=await context.newPage();await destination.goto(new URL('/settings?tab=backup',page.url().replace('127.0.0.1','localhost')).href);
  await destination.getByLabel('Restore JSON file',{exact:true}).setInputFiles(path);await expect(destination.getByText('Backup validated, including its data references.',{exact:true})).toBeVisible(); await destination.getByRole('button',{name:'Next: keep current data',exact:true}).click();
  const before=destination.waitForEvent('download');await destination.getByRole('button',{name:'Download current data before replacement',exact:true}).click();const current=await before;const currentPath=info.outputPath('pre-restore.json');await current.saveAs(currentPath);const currentText=await readFile(currentPath,'utf8');
  expect(await page.evaluate(async text=>{const p='/tests/e2e/helpers/cal-browser.ts';return(await import(/* @vite-ignore */ p)).verifyIsolatedRestore(text);},currentText)).toMatchObject({same:true});
  await destination.getByLabel('I have downloaded and kept the current backup',{exact:true}).check(); await destination.getByRole('button',{name:'Next: confirm replacement',exact:true}).click(); await destination.getByLabel('I confirm my current data is safely kept separately',{exact:true}).check();await destination.getByLabel('I confirm replacing all local data',{exact:true}).check();await destination.getByRole('button',{name:'Replace local data',exact:true}).click();
  await expect.poll(()=>destination.evaluate(async()=>{const p='/src/persistence/db.ts';const {database}=await import(/* @vite-ignore */ p);return (await database.metadata.toCollection().first())?.restoreGeneration;})).toBe(1);
  const identical=await destination.evaluate(async sourceData=>{const h='/tests/e2e/helpers/cal-browser.ts';const {canonicalFacts}=await import(/* @vite-ignore */ h);const b='/src/application/backup.ts';const {backupService}=await import(/* @vite-ignore */ b);return canonicalFacts(sourceData)===canonicalFacts(JSON.parse(await(await backupService.exportBackup()).text()).data);},source.data);expect(identical).toBe(true);
});
test('rejects two occupying new day plans without changing the source library',async({page})=>{
  await page.goto('/');const result=await page.evaluate(async()=>{
    const h='/tests/e2e/helpers/cal-browser.ts';await(await import(/* @vite-ignore */ h)).seedCalLibrary();const b='/src/application/backup.ts';const {backupService}=await import(/* @vite-ignore */ b);
    const original=JSON.parse(await(await backupService.exportBackup()).text());const data=structuredClone(original.data);const plan=structuredClone(data.plans.find((p:{model?:string})=>p.model==='date-day'));
    const version=structuredClone(data.planVersions.find((v:{id:string})=>v.id===plan.currentVersionId));const row=structuredClone(data.scheduledWorkouts.find((r:{planVersionId:string})=>r.planVersionId===version.id));
    plan.id=crypto.randomUUID();version.id=crypto.randomUUID();version.planId=plan.id;version.versionNumber=1;version.days[0].dayId=crypto.randomUUID();plan.currentVersionId=version.id;row.id=crypto.randomUUID();row.planVersionId=version.id;row.plannedDayId=version.days[0].dayId;delete row.completedSessionId;
    data.plans.push(plan);data.planVersions.push(version);data.scheduledWorkouts.push(row);
    return backupService.validateBackup(new File([JSON.stringify({...original,data})],'duplicate.json')).then(()=> 'accepted',(e:{code:string})=>e.code);
  });expect(result).toBe('BACKUP_REFERENCE_INVALID');
});
test('legacy v2 JSON retains original facts and adds V8 plans on restore',async({page})=>{
  await page.goto('/');const result=await page.evaluate(async()=>{const p='/tests/e2e/helpers/cal-browser.ts';const h=await import(/* @vite-ignore */ p);const {oldJson}=await h.seedCalLibrary();return h.verifyIsolatedRestore(oldJson);});
  expect(result).toEqual({same:true,version:6,metadata:8});
});
