import {test, expect, type Page} from '@playwright/test';
import {validateGuidedProviderOutput} from '../../src/backend/guided-provider';
import {exercises} from '../../src/catalog/exercises';

test.setTimeout(60000);
const simple = exercises.find(item => item.metricType === 'reps' && item.equipment === 'none')!;
async function fixture(page:Page, options:{fail?:'understand'|'generate';maxDays?:number}={}) {
  const sent:any[]=[];
  await page.addInitScript(() => localStorage.setItem('fitness.language','en'));
  await page.route('**/api/v1/**', async route => {
    if(route.request().method()==='GET') return route.fulfill({json:{expiresAt:Date.now()+86400000,period:'2026-10',used:{understand:0,generate:0},limits:{understand:8,generate:4},pending:0,aiEnabled:true,...(options.maxDays?{maxDays:options.maxDays}:{})}});
    const body=route.request().postDataJSON();sent.push(body);
    if(body.operation===options.fail) return route.fulfill({status:503,json:{error:'CONTROL_UNAVAILABLE'}});
    const raw=body.operation==='understand'?{kind:'understand',summary:'Build strength at home with bodyweight training, 30 minutes, no stated restrictions.',uncertainties:[]}:
      {kind:'program',name:'Controlled fixture plan',explanation:'Synthetic response for a local browser test.',days:body.dialogue.dates.map((date:string)=>({date,exercises:[{exerciseId:simple.id,order:0,targetSets:[{metricType:'reps',reps:8}],setTimings:[{durationSeconds:40,restSeconds:30}],notes:'Controlled movement'}]}))};
    return route.fulfill({json:{requestId:body.requestId,accounting:'settled',result:validateGuidedProviderOutput(body.dialogue,raw),context:{restoreGeneration:body.restoreGeneration,inputDigest:body.sendConfirmation}}});
  });
  await page.goto('/ai');
  await expect(page.getByRole('textbox',{name:'Training goal and constraints'})).toBeEnabled();
  await page.getByRole('textbox',{name:'Training goal and constraints'}).fill('Build strength at home');
  await page.getByRole('textbox',{name:'Experience',exact:true}).fill('Beginner');
  await page.getByRole('textbox',{name:'Location',exact:true}).fill('Home');
  await page.getByRole('textbox',{name:'Equipment',exact:true}).fill('None');
  return sent;
}
async function understand(page:Page) {
  await page.getByRole('checkbox',{name:/I reviewed this information/}).check();
  await page.getByRole('button',{name:'Understand goal',exact:true}).click();
  await expect(page.getByRole('heading',{name:'AI understanding · review needed'})).toBeVisible();
  await page.getByRole('checkbox',{name:'I confirm this understanding is correct',exact:true}).check();
  await page.getByRole('button',{name:'Choose dates →',exact:true}).click();
}
async function datesAndPreview(page:Page) {
  const date = await page.locator('[data-plan-date]').nth(15).getAttribute('data-plan-date');
  await page.locator(`[data-plan-date="${date}"]`).click();
  await page.getByLabel('Start time',{exact:true}).fill('12:00');
  await page.getByLabel('Focus for this day (optional)').fill('Legs with controlled bodyweight movements');
  await page.getByRole('button',{name:'Review sending →'}).click();
  await expect(page.getByText('Exact information sent this time',{exact:true})).toBeVisible();
  return date!;
}
async function generate(page:Page) {
  await page.getByRole('checkbox',{name:/I confirm these fields and dates/}).check();
  await page.getByRole('button',{name:'Generate proposal →',exact:true}).click();
  await expect(page.getByRole('heading',{name:'04 · Review your proposal, then save'})).toBeVisible();
  await expect(page.getByRole('checkbox',{name:/I reviewed each day/})).toBeEnabled();
}
async function taskCount(page:Page) {return page.evaluate(async()=>{const path='/src/persistence/db.ts';const{database}=await import(/* @vite-ignore */path);return database.scheduledWorkouts.count();});}

test('two sends require consent; history excluded; candidate editable and saved only by independent confirmation',async({page},info)=>{
  const sent=await fixture(page);
  await expect(page.getByRole('button',{name:'Understand goal',exact:true})).toBeDisabled();
  expect(sent).toHaveLength(0);await understand(page);expect(sent).toHaveLength(1);
  const date=await datesAndPreview(page);
  await expect(page.getByRole('button',{name:'Generate proposal →',exact:true})).toBeDisabled();
  await generate(page);expect(sent).toHaveLength(2);expect(await taskCount(page)).toBe(0);
  for(const request of sent){expect(request.dialogue.scope).not.toHaveProperty('body');expect(request.dialogue.scope).not.toHaveProperty('history');expect(request.dialogue.scope.conditions).not.toHaveProperty('priorDialogue');}
  expect(sent[1].dialogue.dates).toEqual([date]);expect(sent[1].dialogue.schedule[0].startTime).toBe('12:00');
  expect(sent[1].dialogue.scope.conditions.dailyFocus[0].focus).toContain('Legs');
  await page.getByLabel('Plan name',{exact:true}).fill('Reviewed local plan');
  await page.getByLabel('Start time',{exact:true}).fill('14:00');
  await expect(page.getByRole('button',{name:'Confirm & save all daily plans'})).toBeDisabled();
  await page.getByRole('checkbox',{name:/I reviewed each day/}).check();
  await page.getByRole('button',{name:'Confirm & save all daily plans'}).click();
  await expect(page.getByRole('button',{name:'Saved',exact:true})).toBeDisabled();
  expect(await taskCount(page)).toBe(1);expect(sent).toHaveLength(2);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'})); await page.screenshot({path:`outputs/v31-ai-saved-${info.project.name}.png`,fullPage:true});
});

test('changing goal invalidates earlier consent and understanding; explicit retry keeps request ID',async({page})=>{
  const sent=await fixture(page,{fail:'understand'});
  await page.getByRole('checkbox',{name:/I reviewed this information/}).check();
  await page.getByRole('button',{name:'Understand goal',exact:true}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button',{name:'Retry this understanding request'}).click();
  await expect.poll(()=>sent.length).toBe(2);expect(sent[0].requestId).toBe(sent[1].requestId);
  await page.getByRole('textbox',{name:'Training goal and constraints'}).fill('A new goal');
  await expect(page.getByRole('checkbox',{name:/I reviewed this information/})).not.toBeChecked();
  await expect(page.getByRole('button',{name:'Understand goal',exact:true})).toBeDisabled();
  await expect(page.getByRole('button',{name:'Choose dates →'})).toBeDisabled();
});

test('occupied date appearing after generation keeps candidate and does not make a new AI request',async({page})=>{
  const sent=await fixture(page);await understand(page);const date=await datesAndPreview(page);await generate(page);
  await page.evaluate(async({date,exerciseId})=>{
    const servicePath='/src/application/day-plans.ts', profilePath='/src/application/profile.ts';
    const{dayPlanService}=await import(/* @vite-ignore */servicePath);const{profileService}=await import(/* @vite-ignore */profilePath);
    await dayPlanService.saveDayPlan({name:'Other tab plan',date,timeZone:(await profileService.getProfile()).timeZone,exercises:[{exerciseId,order:0,targetSets:[{metricType:'reps',reps:5}]}]});
  },{date,exerciseId:simple.id});
  await page.getByRole('checkbox',{name:/I reviewed each day/}).check();await page.getByRole('button',{name:'Confirm & save all daily plans'}).click();
  await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByLabel('Plan name',{exact:true})).toHaveValue('Controlled fixture plan');
  expect(await taskCount(page)).toBe(1);expect(sent).toHaveLength(2);
});

test('declining previously selected optional fields removes them from the exact network request',async({page})=>{
  const sent=await fixture(page);await understand(page);await datesAndPreview(page);
  await page.evaluate(async()=>{
    const p='/src/application/profile.ts', w='/src/application/body-weight.ts';
    const{profileService}=await import(/* @vite-ignore */p);const{bodyWeightService}=await import(/* @vite-ignore */w);
    await bodyWeightService.saveBodyWeight({localDate:'2026-10-03',timeZone:(await profileService.getProfile()).timeZone,weightGrams:72000});
  });
  const body=page.getByRole('checkbox',{name:'Optional: include supplied body information'});
  const history=page.getByRole('checkbox',{name:/Optional: include training, sets and weights/});
  await body.check();await history.check();await page.getByRole('button',{name:'Update sending preview'}).click();
  await page.getByRole('checkbox',{name:/I confirm these fields and dates/}).check();
  await body.uncheck();await history.uncheck();
  await expect(page.getByRole('button',{name:'Generate proposal →'})).toBeDisabled();
  await page.getByRole('button',{name:'Update sending preview'}).click();await generate(page);
  expect(sent[1].dialogue.scope).not.toHaveProperty('history');expect(sent[1].dialogue.scope).not.toHaveProperty('body');
});

test('theme changes preserve candidate edits and do not send another model request',async({page},info)=>{
  const sent=await fixture(page);await understand(page);await datesAndPreview(page);await generate(page);
  await page.getByLabel('Plan name',{exact:true}).fill('Unsubmitted candidate edit');
  for(const theme of ['serene','orbit','atlas']) {
    await page.getByRole('combobox',{name:'Switch layout'}).selectOption(theme);
    await expect(page.getByLabel('Plan name',{exact:true})).toHaveValue('Unsubmitted candidate edit');
    expect(sent).toHaveLength(2);expect(await taskCount(page)).toBe(0);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'})); await page.screenshot({path:`outputs/v31-ai-${theme}-${info.project.name}.png`,fullPage:true});
  }
});

test('failed generation retries only its original request and does not save automatically',async({page})=>{
  const sent=await fixture(page,{fail:'generate'});await understand(page);await datesAndPreview(page);
  await page.getByRole('checkbox',{name:/I confirm these fields and dates/}).check();
  await page.getByRole('button',{name:'Generate proposal →'}).click();await expect(page.getByRole('alert')).toBeVisible();
  await page.getByRole('button',{name:'Retry this generation request'}).click();await expect.poll(()=>sent.length).toBe(3);
  expect(sent[2]).toEqual(sent[1]);expect(sent.map(value=>value.operation)).toEqual(['understand','generate','generate']);expect(await taskCount(page)).toBe(0);
});

test('unrelated local message changes do not invalidate independent candidate save',async({page})=>{
  const sent=await fixture(page);await understand(page);await datesAndPreview(page);await generate(page);
  await page.evaluate(async()=>{const path='/src/application/guided.ts';const{guidedService}=await import(/* @vite-ignore */path);await guidedService.appendMessage({id:crypto.randomUUID(),conversationId:crypto.randomUUID(),role:'user',content:'Unrelated local-only note',createdAt:new Date().toISOString()},(await guidedService.read()).revision);});
  await page.getByRole('checkbox',{name:/I reviewed each day/}).check();await page.getByRole('button',{name:'Confirm & save all daily plans'}).click();
  await expect(page.getByRole('button',{name:'Saved',exact:true})).toBeDisabled();expect(await taskCount(page)).toBe(1);expect(sent).toHaveLength(2);
});

test('restore generation invalidates the old candidate without another paid request',async({page})=>{
  const sent=await fixture(page);await understand(page);await datesAndPreview(page);await generate(page);
  await page.evaluate(async()=>{const path='/src/persistence/db.ts';const{database}=await import(/* @vite-ignore */path);await database.transaction('rw',database.metadata,async()=>{const row=await database.metadata.toCollection().first();await database.metadata.put({...row,restoreGeneration:(row.restoreGeneration??0)+1});});});
  // The root restore boundary remounts the route. No stale save action survives it.
  await expect(page.getByRole('button',{name:'Confirm & save all daily plans'})).toHaveCount(0);
  expect(await taskCount(page)).toBe(0);expect(sent).toHaveLength(2);
});

test('invalid duration is rejected locally before an AI request',async({page})=>{
  const sent=await fixture(page);await page.getByLabel('Minutes per session',{exact:true}).fill('0');
  await page.getByRole('checkbox',{name:/I reviewed this information/}).check();await page.getByRole('button',{name:'Understand goal',exact:true}).click();
  await expect(page.getByRole('alert')).toContainText('Enter 1–240 minutes');expect(sent).toHaveLength(0);
});


test('AI date selection respects the current server day limit without another model call',async({page})=>{
  const sent=await fixture(page,{maxDays:2});await understand(page);
  await expect(page.getByText('Choose nonconsecutive dates across months: up to 2 dates within 31 days. Each day is an independent plan.')).toBeVisible();
  const buttons=page.locator('[data-plan-date]');
  await buttons.nth(12).click();await buttons.nth(13).click();await buttons.nth(14).click();
  await expect(buttons.nth(14)).toHaveAttribute('aria-pressed','false');
  await expect(page.getByLabel('Start time',{exact:true})).toHaveCount(2);
  expect(sent).toHaveLength(1);
});
