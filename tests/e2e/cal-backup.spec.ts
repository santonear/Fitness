import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
// Preserve the real IndexedDB contract after retiring the legacy presentation.
test.beforeEach(async({page})=>{await page.goto("/tests/e2e/helpers/capacity-entry.html");});
test('rejects two occupying new day plans without changing the source library',async({page})=>{
  await page.goto('/tests/e2e/helpers/capacity-entry.html');const result=await page.evaluate(async()=>{
    const h='/tests/e2e/helpers/cal-browser.ts';await(await import(/* @vite-ignore */ h)).seedCalLibrary();const b='/src/application/backup.ts';const {backupService}=await import(/* @vite-ignore */ b);
    const original=JSON.parse(await(await backupService.exportBackup()).text());const data=structuredClone(original.data);const plan=structuredClone(data.plans.find((p:{model?:string})=>p.model==='date-day'));
    const version=structuredClone(data.planVersions.find((v:{id:string})=>v.id===plan.currentVersionId));const row=structuredClone(data.scheduledWorkouts.find((r:{planVersionId:string})=>r.planVersionId===version.id));
    plan.id=crypto.randomUUID();version.id=crypto.randomUUID();version.planId=plan.id;version.versionNumber=1;version.days[0].dayId=crypto.randomUUID();plan.currentVersionId=version.id;row.id=crypto.randomUUID();row.planVersionId=version.id;row.plannedDayId=version.days[0].dayId;delete row.completedSessionId;
    data.plans.push(plan);data.planVersions.push(version);data.scheduledWorkouts.push(row);
    return backupService.validateBackup(new File([JSON.stringify({...original,data})],'duplicate.json')).then(()=> 'accepted',(e:{code:string})=>e.code);
  });expect(result).toBe('BACKUP_REFERENCE_INVALID');
});
test('legacy v2 JSON retains original facts and adds V8 plans on restore',async({page})=>{
  await page.goto('/tests/e2e/helpers/capacity-entry.html');const result=await page.evaluate(async()=>{const p='/tests/e2e/helpers/cal-browser.ts';const h=await import(/* @vite-ignore */ p);const {oldJson}=await h.seedCalLibrary();return h.verifyIsolatedRestore(oldJson);});
  expect(result).toEqual({same:true,version:6,metadata:8});
});
