import {test,expect} from '@playwright/test';
// Preserve the real IndexedDB contract after retiring the legacy presentation.
test.beforeEach(async({page})=>{await page.goto("/tests/e2e/helpers/capacity-entry.html");});
test('V4 local transactions keep revision and restore-generation protection, export all answers without measurements',async({page})=>{
 await page.goto('/tests/e2e/helpers/capacity-entry.html');
 const result=await page.evaluate(async()=>{
  const p='/src/application/profile.ts',g='/src/application/guided.ts',b='/src/application/backup.ts',r='/src/persistence/repository.ts',d='/src/domain/onboarding-v4.ts';
  const {profileService}=await import(/* @vite-ignore */p);const {guidedService}=await import(/* @vite-ignore */g);const {createBackupService,validateBackupEnvelope}=await import(/* @vite-ignore */b);const {repository}=await import(/* @vite-ignore */r);const {onboardingKeys}=await import(/* @vite-ignore */d);
  await profileService.initialize('en');const before=await guidedService.read();const answers=Object.fromEntries(onboardingKeys.map((k:string)=>[k,{status:'skipped'}]));answers.age={status:'answered',value:12};answers.weightKg={status:'answered',value:75};answers.preferences={status:'answered',value:'Quiet music'};
  await guidedService.saveV4(answers,12,before.revision);let stale=false;try{await guidedService.saveV4(answers,0,before.revision);}catch{stale=true;}
  const now=await guidedService.read();await guidedService.completeOnboarding(now.revision);const backup=JSON.parse(await(await createBackupService(repository).exportBackup()).text());validateBackupEnvelope(backup);
  const {createRepository}=await import(/* @vite-ignore */r);const {createGuidedService}=await import(/* @vite-ignore */g);
  const staleService=createGuidedService(createRepository(repository.db));const snapshot=JSON.stringify(await staleService.read());
  const backupService=createBackupService(repository);const validated=await backupService.validateBackup(new File([JSON.stringify(backup)],'v4.json',{type:'application/json'}));
  await backupService.importBackup(validated,{backupExported:true,replacementConfirmed:true,expectedRevision:validated.expectedRevision});
  let replaced=false;try{await staleService.saveV4(answers,0,(await staleService.read()).revision);}catch{replaced=true;}
  return {stale,replaced,unchanged:snapshot===JSON.stringify(await guidedService.read()),weights:await repository.db.bodyWeights.count(),onboarding:backup.data.guidedStates[0].onboarding};
 });expect(result).toMatchObject({stale:true,replaced:true,unchanged:true,weights:0,onboarding:{version:4,completed:true,answers:{age:{value:12},preferences:{value:'Quiet music'}}}});
});
test('legacy completed onboarding is not forced through the upgrade',async({page})=>{
 await page.goto('/tests/e2e/helpers/capacity-entry.html');await page.evaluate(async()=>{const p='/src/application/profile.ts',g='/src/application/guided.ts';const {profileService}=await import(/* @vite-ignore */p);const {guidedService}=await import(/* @vite-ignore */g);await profileService.initialize('en');let s=await guidedService.read();await guidedService.saveAnswer('biologicalSex',{status:'answered',value:'不愿透露'},0,s.revision);s=await guidedService.read();await guidedService.completeOnboarding(s.revision);});await page.goto('/tests/e2e/helpers/capacity-entry.html');await expect(page).not.toHaveURL(/onboarding/);
});
