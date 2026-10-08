import {test, expect, type Page} from '@playwright/test';
import {validateGuidedProviderOutput} from '../../src/backend/guided-provider';
import {exercises} from '../../src/catalog/exercises';

test.setTimeout(60000);
async function setup(page: Page, seed = true) {
  const sent: any[] = [];
  await page.addInitScript(() => localStorage.setItem('fitness.language', 'en'));
  await page.route('**/api/v1/**', async route => {
    if (route.request().method() === 'GET') return route.fulfill({json:{expiresAt:Date.now()+86400000,period:'2026-10',used:{understand:0,generate:0},limits:{understand:8,generate:4},pending:0,aiEnabled:true}});
    const request = route.request().postDataJSON(); sent.push(request);
    const raw = request.operation === 'understand' ? {kind:'understand',summary:'Build strength at home.',uncertainties:[]} : {kind:'program',name:'Local fixture',explanation:'Test only',days:request.dialogue.dates.map((date: string) => ({date,exercises:[{exerciseId:exercises.find(x => x.metricType === 'reps')!.id,order:0,targetSets:[{metricType:'reps',reps:8}],setTimings:[{durationSeconds:40,restSeconds:30}]}]}))};
    return route.fulfill({json:{requestId:request.requestId,accounting:'settled',result:validateGuidedProviderOutput(request.dialogue,raw),context:{restoreGeneration:request.restoreGeneration,inputDigest:request.sendConfirmation}}});
  });
  await page.goto('/ai');
  await expect(page.getByLabel('Training goal and constraints')).toBeEnabled();
  if (seed) {
    await page.evaluate(async () => {
      const p='/src/application/profile.ts', w='/src/application/body-weight.ts', g='/src/application/guided.ts';
      const {profileService}=await import(/* @vite-ignore */p);
      const {bodyWeightService}=await import(/* @vite-ignore */w);
      const {guidedService}=await import(/* @vite-ignore */g);
      const profile=await profileService.getProfile();
      await profileService.saveProfile({locale:'en',timeZone:profile.timeZone,units:'metric',trainingPreferences:{goal:'Saved strength goal',experience:'Beginner',constraints:'Avoid jumping',availableEquipment:['Mat'],trainingLocation:'home',sessionMinutes:25,heightCm:178,weightGrams:76000,updatedAt:'2026-10-01T00:00:00Z'}},profile.revision);
      await bodyWeightService.saveBodyWeight({localDate:'2026-10-02',timeZone:profile.timeZone,weightGrams:73500});
      await bodyWeightService.saveBodyWeight({localDate:'2026-10-03',timeZone:profile.timeZone,weightGrams:73000});
      for (const item of [{kind:'waist',value:82,unit:'cm'},{kind:'bodyFat',value:20,unit:'%'}]) await guidedService.saveObservation({id:crypto.randomUUID(),...item,localDate:'2026-10-03',timeZone:profile.timeZone,method:'Tape / scale',createdAt:'2026-10-03T00:00:00Z'},(await guidedService.read()).revision);
    });
    await page.reload();
    await expect(page.getByLabel('Training goal and constraints')).toHaveValue('Saved strength goal');
    await expect(page.getByLabel('Movement restrictions (optional)')).toHaveValue('Avoid jumping');
  } else await page.getByLabel('Training goal and constraints').fill('Build strength');
  return sent;
}
async function review(page: Page) {
  await page.getByRole('checkbox',{name:/I reviewed this information/}).check();
  await page.getByRole('button',{name:'Understand goal',exact:true}).click();
  await page.getByRole('checkbox',{name:'I confirm this understanding is correct',exact:true}).check();
  await page.getByRole('button',{name:'Choose dates →'}).click();
  await page.locator('[data-plan-date]').nth(15).click();
  await page.getByRole('button',{name:'Review sending →'}).click();
}
async function generate(page: Page) {
  await page.getByRole('checkbox',{name:/I confirm these fields and dates/}).check();
  await page.getByRole('button',{name:'Generate proposal →'}).click();
  await expect(page.getByRole('heading',{name:'04 · Review your proposal, then save'})).toBeVisible();
}
test('current saved body measurements have sources, remain opt-in, and changes invalidate reviewed sending',async({page}) => {
  const sent=await setup(page); await review(page);
  expect(sent[0].dialogue.scope).not.toHaveProperty('body');
  expect(sent[0].dialogue.scope.conditions.restrictions).toBe('Avoid jumping');
  const checkbox=page.getByRole('checkbox',{name:'Optional: include supplied body information'});
  await expect(checkbox).not.toBeChecked(); await checkbox.check();
  await page.getByRole('button',{name:'Update sending preview'}).click();
  await page.getByRole('checkbox',{name:/I confirm these fields and dates/}).check();
  await page.evaluate(async() => {
    const w='/src/application/body-weight.ts',p='/src/application/profile.ts';
    const{bodyWeightService}=await import(/* @vite-ignore */w); const{profileService}=await import(/* @vite-ignore */p);
    await bodyWeightService.saveBodyWeight({localDate:'2026-10-04',timeZone:(await profileService.getProfile()).timeZone,weightGrams:72000});
  });
  await expect(page.getByRole('button',{name:'Generate proposal →'})).toBeDisabled();
  await page.getByRole('button',{name:'Update sending preview'}).click();
  await generate(page);
  const body=sent[1].dialogue.scope.body;
  expect(body.heightCm).toEqual({value:178,unit:'cm',source:'profile',recordedAt:'2026-10-01T00:00:00Z'});
  expect(body.weightKg).toMatchObject({value:72,unit:'kg',source:'body-weight-observation',observedOn:'2026-10-04'});
  expect(body.waistCm).toMatchObject({value:82,source:'body-observation',observedOn:'2026-10-03',method:'Tape / scale'});
  expect(body.bodyFatPercent).toMatchObject({value:20,unit:'%'});
  expect(sent[1].dialogue.scope).not.toHaveProperty('history');
});
test('deselecting body and history removes both from the actual request',async({page}) => {
  const sent=await setup(page); await review(page);
  const body=page.getByRole('checkbox',{name:'Optional: include supplied body information'});
  const history=page.getByRole('checkbox',{name:/Optional: include training, sets and weights/});
  await body.check(); await history.check(); await page.getByRole('button',{name:'Update sending preview'}).click();
  await body.uncheck(); await history.uncheck(); await page.getByRole('button',{name:'Update sending preview'}).click(); await generate(page);
  for(const request of sent) {expect(request.dialogue.scope).not.toHaveProperty('body'); expect(request.dialogue.scope).not.toHaveProperty('history');}
});
test('no saved body information disables optional body without inventing values',async({page}) => {
  const sent=await setup(page,false); await review(page);
  await expect(page.getByRole('checkbox',{name:'Optional: include supplied body information'})).toBeDisabled();
  await expect(page.getByText('No saved body information.',{exact:false})).toBeVisible();
  await generate(page); expect(sent[1].dialogue.scope).not.toHaveProperty('body');
});
