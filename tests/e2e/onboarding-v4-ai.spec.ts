import {test,expect} from '@playwright/test';
import {validateGuidedProviderOutput} from '../../src/backend/guided-provider';
import {exercises} from '../../src/catalog/exercises';

test('V4 answers reach two explicit send previews; optional data is excluded; proposal waits for local save',async({page})=>{
 const sent:any[]=[];
 await page.addInitScript(()=>localStorage.setItem('fitness.language','en'));
 await page.route('**/api/v1/**',async route=>{
  if(route.request().method()==='GET')return route.fulfill({json:{expiresAt:Date.now()+86400000,period:'2026-10',used:{understand:0,generate:0},limits:{understand:8,generate:4},pending:0,aiEnabled:true}});
  const body=route.request().postDataJSON();sent.push(body);
  const raw=body.operation==='understand'?{kind:'understand',summary:'Strength at home, without jumping. A quiet session.',uncertainties:[]}:{kind:'program',name:'V4 proposal',explanation:'Local test response',days:body.dialogue.dates.map((date:string)=>({date,exercises:[{exerciseId:exercises.find(e=>e.metricType==='reps'&&e.equipment==='none')!.id,order:0,targetSets:[{metricType:'reps',reps:8}],setTimings:[{durationSeconds:40,restSeconds:30}]}]}))};
  return route.fulfill({json:{requestId:body.requestId,accounting:'settled',result:validateGuidedProviderOutput(body.dialogue,raw),context:{restoreGeneration:body.restoreGeneration,inputDigest:body.sendConfirmation}}});
 });
 await page.goto('/settings');await page.evaluate(async()=>{
  const p='/src/application/profile.ts',g='/src/application/guided.ts',d='/src/domain/onboarding-v4.ts';
  const {profileService}=await import(/* @vite-ignore */p);const {guidedService}=await import(/* @vite-ignore */g);const {onboardingKeys}=await import(/* @vite-ignore */d);await profileService.initialize('en');
  const answers=Object.fromEntries(onboardingKeys.map((key:string)=>[key,{status:'skipped'}]));
  for(const [key,value] of Object.entries({age:18,goal:['Strength'],experience:'Beginner',location:['Home','Park'],equipment:['Mat'],safety:['No jumping'],preferences:'Quiet session',weightKg:70,schedule:['0','40']}))answers[key]={status:'answered',value};
  await guidedService.saveV4(answers,12,(await guidedService.read()).revision);await guidedService.completeOnboarding((await guidedService.read()).revision);
 });
 await page.goto('/ai');await expect(page.getByLabel('Training goal and constraints')).toHaveValue('Strength');
 await expect(page.getByLabel('Usual start time')).toHaveValue('00:00');await expect(page.getByLabel('Minutes per session',{exact:true})).toHaveValue('40');
 await expect(page.getByRole('button',{name:'Understand goal',exact:true})).toBeDisabled();expect(sent).toHaveLength(0);
 await page.getByRole('checkbox',{name:/I reviewed this information/}).check();
 // An answer changed in another view invalidates the already reviewed request.
 await page.evaluate(async()=>{const g='/src/application/guided.ts';const {guidedService}=await import(/* @vite-ignore */g);const s=await guidedService.read();await guidedService.saveV4({...s.onboarding.answers,preferences:{status:'answered',value:'Quiet morning'}},12,s.revision);});
 await expect(page.getByRole('checkbox',{name:/I reviewed this information/})).not.toBeChecked();
 await page.evaluate(async()=>{const g='/src/application/guided.ts';const {guidedService}=await import(/* @vite-ignore */g);await guidedService.completeOnboarding((await guidedService.read()).revision);});await page.reload();await page.getByRole('checkbox',{name:/I reviewed this information/}).check();await page.getByRole('button',{name:'Understand goal',exact:true}).click();
 await page.getByRole('checkbox',{name:'I confirm this understanding is correct',exact:true}).check();await page.getByRole('button',{name:'Choose dates →'}).click();
 await page.locator('[data-plan-date]').nth(15).click();await page.getByRole('button',{name:'Review sending →'}).click();
 await expect(page.getByRole('button',{name:'Generate proposal →'})).toBeDisabled();
 await page.getByRole('checkbox',{name:/I confirm these fields and dates/}).check();await page.getByRole('button',{name:'Generate proposal →'}).click();
 await expect(page.getByRole('heading',{name:'04 · Review your proposal, then save'})).toBeVisible();
 const count=()=>page.evaluate(async()=>{const d='/src/persistence/db.ts';return (await import(/* @vite-ignore */d)).database.scheduledWorkouts.count();});
 expect(await count()).toBe(0);expect(sent).toHaveLength(2);
 for(const request of sent){expect(request.dialogue).toMatchObject({onboardingVersion:4,adultConfirmed:true});expect(request.dialogue.scope).not.toHaveProperty('body');expect(request.dialogue.scope).not.toHaveProperty('history');expect(JSON.stringify(request.dialogue.scope)).toContain('Quiet morning');}
 await page.getByLabel('Start time',{exact:true}).fill('14:00');await page.getByRole('checkbox',{name:/I reviewed each day/}).check();await page.getByRole('button',{name:'Confirm & save all daily plans'}).click();await expect(page.getByRole('button',{name:'Saved',exact:true})).toBeDisabled();expect(await count()).toBe(1);expect(sent).toHaveLength(2);
});

test('existing training facts bypass first-run onboarding',async({page})=>{
 await page.goto('/workout');await page.getByRole('button',{name:'Start temporary workout',exact:true}).click();await expect(page.getByLabel('Reps',{exact:true})).toBeVisible();await page.goto('/');await expect(page.locator('.v31-hero')).toBeVisible();await expect(page).not.toHaveURL(/onboarding/);
});

