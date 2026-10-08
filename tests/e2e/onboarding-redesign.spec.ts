import {expect,test,type Page} from '@playwright/test';
// V3.1 replaces the mandatory welcome questionnaire with optional local settings.
// Body/sex transmission consent is exercised by v31-ai-body.spec.ts against actual requests.
async function state(page:Page){return page.evaluate(async()=>{const path='/src/persistence/db.ts';const {database}=await import(/* @vite-ignore */path);return {profile:await database.profiles.toCollection().first(),weights:await database.bodyWeights.toArray(),sessions:await database.sessions.toArray()};});}
for(const locale of ['zh','en'] as const)test(`${locale}: optional profile has no sample facts; explicit save persists without weight observations`,async({page})=>{
 const t=(zh:string,en:string)=>locale==='zh'?zh:en;
 await page.addInitScript(l=>localStorage.setItem('fitness.language',l),locale);
 await page.goto('/settings?tab=profile');
 const goal=page.getByLabel(t('目标','Goal'),{exact:true});await expect(goal).toBeEnabled();await expect(goal).toHaveValue('');
 expect((await state(page)).profile.trainingPreferences).toBeUndefined();
 await goal.fill('Build strength');await page.getByLabel(t('资料体重（千克）','Profile weight (kg)'),{exact:true}).fill('82.5');
 expect((await state(page)).profile.trainingPreferences).toBeUndefined();
 await page.getByRole('button',{name:t('保存资料','Save profile'),exact:true}).click();
 await expect(page.getByRole('status')).toContainText(t('资料已保存','Profile saved'));
 expect((await state(page)).profile.trainingPreferences).toMatchObject({goal:'Build strength',weightGrams:82500});
 expect((await state(page)).weights).toEqual([]);expect((await state(page)).sessions).toEqual([]);
 await page.reload();await expect(goal).toHaveValue('Build strength');
 await expect(page.getByLabel(t('限制条件','Constraints'),{exact:true})).toHaveValue('');
 await page.getByRole('button',{name:t('清除偏好','Clear preferences'),exact:true}).click();
 await expect(goal).toHaveValue('');expect((await state(page)).profile.trainingPreferences).toBeUndefined();
});
test('failed profile write retains draft and original facts; explicit offline retry saves once',async({page,context})=>{
 await page.addInitScript(()=>localStorage.setItem('fitness.language','en'));await page.goto('/settings?tab=profile');
 const input=page.getByLabel('Constraints',{exact:true});await expect(input).toBeEnabled();await input.fill('Avoid knee impact');
 const before=await state(page);
 await page.evaluate(()=>{const original=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args:Parameters<typeof original>){if(this.name==='profiles'){IDBObjectStore.prototype.put=original;throw new DOMException('Synthetic failure','QuotaExceededError');}return original.apply(this,args);};});
 await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();
 expect(await state(page)).toEqual(before);await expect(input).toHaveValue('Avoid knee impact');
 await context.setOffline(true);await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('status')).toContainText('Profile saved');
 expect((await state(page)).profile.trainingPreferences.constraints).toBe('Avoid knee impact');expect((await state(page)).weights).toEqual([]);expect((await state(page)).sessions).toEqual([]);
});
test('profile rejects invalid values and remains reachable at narrow widths without microphone invocation',async({page})=>{
 await page.addInitScript(()=>{localStorage.setItem('fitness.language','en');(window as any).speechStarts=0;(window as any).SpeechRecognition=class{start(){(window as any).speechStarts++;}};});
 await page.goto('/settings?tab=profile');await expect(page.getByLabel('Days per week',{exact:true})).toBeEnabled();const before=await state(page);
 await page.getByLabel('Days per week',{exact:true}).fill('8');await page.getByRole('button',{name:'Save profile',exact:true}).click();await expect(page.getByRole('alert')).toBeVisible();expect(await state(page)).toEqual(before);
 await page.emulateMedia({reducedMotion:'reduce'});
 for(const width of [320,375,390,430,1280]){await page.setViewportSize({width,height:844});await expect(page.getByRole('button',{name:'Save profile',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 expect(await page.evaluate(()=>(window as any).speechStarts)).toBe(0);
});
