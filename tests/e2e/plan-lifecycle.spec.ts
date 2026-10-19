import { test, expect, type Page } from '@playwright/test';
import {answerTexts,basicSafety,generate,startOnboarding,toFirstQuestion} from './helpers/onboarding-v9';

// Whole journeys perform several IndexedDB transactions and page reloads under CI WebKit.
test.setTimeout(60000);
let aiCalls=0;
test.beforeEach(async({page})=>{aiCalls=0;await page.route('**/api/v1/features',route=>route.fulfill({json:{version:1,flags:{planLifecycle:true},expiresAt:Date.now()+60000}}));await page.route('**/api/v1/plans/generate',route=>{aiCalls++;return route.abort();});});
test.afterEach(()=>expect(aiCalls).toBe(0));

async function draft(page:Page,goal='保持力量'){
 await page.goto('/onboarding');
 if(goal!=='保持力量')await expect(page.getByRole('heading',{name:'开始前，确认几件事',exact:true})).toBeVisible();
 await toFirstQuestion(page);
 await answerTexts(page,[goal,'每周3次，每次30分钟','在家，只有瑜伽垫']);
 await basicSafety(page);await generate(page);
 await expect(page.getByRole('button',{name:'就用这份计划',exact:true})).toBeVisible();
}
async function createPlan(page:Page){await draft(page);await page.getByRole('button',{name:'就用这份计划',exact:true}).click();await expect(page.getByRole('heading',{name:'今天',exact:true})).toBeVisible();}
async function records(page:Page){return page.evaluate(async()=>{const path='/src/persistence/repository.ts';const {repository}=await import(/* @vite-ignore */ path);return{plans:await repository.db.v8Plans.toArray(),versions:await repository.db.v8PlanVersions.toArray(),workouts:await repository.db.v8Workouts.toArray(),state:await repository.db.v8State.get('v8'),revision:(await repository.readMetadata()).dataRevision};});}
async function finishOneSet(page:Page){
 await page.getByRole('button',{name:'开始训练',exact:true}).first().click();
 await page.getByRole('button',{name:'完成这一组',exact:true}).click();
 await page.getByRole('button',{name:'暂停或结束',exact:true}).click();
 await page.getByRole('dialog').getByRole('button',{name:'结束并记下',exact:true}).click();
 await page.getByRole('button',{name:'记下来',exact:true}).click();
 await expect(page.locator('.v8-facts dd')).toHaveCount(5);await expect(page.locator('.v8-facts dd').nth(1)).toHaveText('1');
}
async function removeCurrentPlan(page:Page){
 await page.goto('/plans');await page.getByRole('button',{name:'不再使用这份计划',exact:true}).click();
 const dialog=page.getByRole('dialog');await expect(dialog).toContainText('训练记录');await expect(dialog).toContainText('回顾');await expect(dialog).toContainText('进步');
 await dialog.getByRole('button',{name:'确认删除',exact:true}).click();await expect(page.getByText('已删除计划',{exact:true})).toBeVisible();await expect(page.getByRole('dialog')).not.toBeVisible();
}

test('deleting the current plan preserves its versions and undo restores the same plan',async({page})=>{
 await createPlan(page);const before=await records(page);await removeCurrentPlan(page);
 const deleted=await records(page);expect(deleted.plans).toHaveLength(1);expect(deleted.plans[0].deletedAt).toEqual(expect.any(String));expect(deleted.state.currentPlanId).toBeUndefined();expect(deleted.versions).toEqual(before.versions);
 await page.getByRole('button',{name:'撤销',exact:true}).click();
 await expect.poll(async()=>(await records(page)).state.currentPlanId).toBe(before.plans[0].id);
 const restored=await records(page);expect(restored.plans[0].deletedAt).toBeUndefined();expect(restored.versions).toEqual(before.versions);
 await page.reload();await expect(page.getByRole('button',{name:'不再使用这份计划',exact:true})).toBeVisible();
});

test('deleted plans leave workout facts and weekly totals intact and restore from settings',async({page})=>{
 await createPlan(page);await finishOneSet(page);const totals=await page.locator('.v8-facts dd').allTextContents();const before=await records(page);expect(before.workouts).toHaveLength(1);expect(before.workouts[0].sets).toHaveLength(1);
 await removeCurrentPlan(page);await page.goto('/');
 await expect(page.getByRole('button',{name:'重新制定计划',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'手动训练',exact:true})).toBeVisible();
 await page.goto('/review');await expect(page.locator('.v8-facts dd')).toHaveText(totals);expect((await records(page)).workouts).toEqual(before.workouts);
 await page.goto('/settings');await page.getByRole('button',{name:'已删除的计划',exact:true}).click();await page.getByRole('button',{name:'恢复',exact:true}).click();
 await expect.poll(async()=>(await records(page)).plans[0].deletedAt).toBeUndefined();
 const restored=await records(page);expect(restored.versions).toEqual(before.versions);expect(restored.workouts).toEqual(before.workouts);
 await page.goto('/review');await expect(page.locator('.v8-facts dd')).toHaveText(totals);
});

test('previous plans can be read and deleted, while individual version detail has no delete action',async({page})=>{
 await createPlan(page);const before=await records(page);
 await draft(page,'第二份训练计划');await page.getByRole('button',{name:'就用这份计划',exact:true}).click();await expect(page.getByRole('heading',{name:'今天',exact:true})).toBeVisible();
 await page.goto('/plans');await expect(page.getByRole('heading',{name:'以前的计划',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'查看',exact:true}).first().click();await expect(page.getByText('保持力量',{exact:true})).toBeVisible();
 await page.goto(`/plans?version=${before.versions[0].id}`);await expect(page.getByRole('heading',{name:'我的计划',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'删除计划',exact:true})).toHaveCount(0);await expect(page.getByRole('button',{name:'不再使用这份计划',exact:true})).toHaveCount(0);
 await page.goto('/plans');await page.getByRole('button',{name:'删除计划',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认删除',exact:true}).click();
 await expect(page.getByText('已删除计划',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'查看',exact:true})).toHaveCount(0);
 const after=await records(page);expect(after.plans.find((plan:any)=>plan.id===before.plans[0].id).deletedAt).toEqual(expect.any(String));expect(after.versions.find((version:any)=>version.id===before.versions[0].id)).toEqual(before.versions[0]);expect(after.state.currentPlanId).not.toBe(before.plans[0].id);
});

test('deleting a plan without workout records keeps the home empty after reload',async({page})=>{
 await createPlan(page);expect((await records(page)).workouts).toHaveLength(0);await removeCurrentPlan(page);await page.goto('/');
 // Let the new document commit its application state before interrupting it
 // with another navigation; retain the real reload and all persistence checks.
 await expect(page.getByRole('button',{name:'重新制定计划',exact:true})).toBeVisible();await page.reload();
 await expect(page).toHaveURL(/\/$/);await expect(page.getByRole('button',{name:'重新制定计划',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'手动训练',exact:true})).toBeVisible();expect((await records(page)).workouts).toHaveLength(0);
});

test('undo expires after ten seconds without purging the recoverable plan',async({page})=>{
 await createPlan(page);await page.clock.install();await removeCurrentPlan(page);await expect(page.getByRole('button',{name:'撤销',exact:true})).toBeVisible();
 await page.clock.fastForward(11000);await expect(page.getByRole('button',{name:'撤销',exact:true})).toHaveCount(0);
 const deleted=await records(page);expect(deleted.plans).toHaveLength(1);expect(deleted.plans[0].deletedAt).toEqual(expect.any(String));expect(deleted.versions).toHaveLength(1);
});

test('discarding an unaccepted draft does not write plan or workout data',async({page})=>{
 await draft(page);const before=await records(page);expect(before.plans).toHaveLength(0);expect(before.versions).toHaveLength(0);
 await page.getByRole('button',{name:'不用这份',exact:true}).click();await expect(page).toHaveURL(/\/$/);
 expect(await records(page)).toEqual(before);await page.reload();expect((await records(page)).plans).toHaveLength(0);
});

test('unfavoriting removes the exercise from favorites and remains removed after reload',async({page})=>{
 await page.goto('/exercises');await page.getByRole('searchbox').fill('自阻力划船');
 const favorite=page.getByRole('button',{name:'收藏 自阻力划船',exact:true});await favorite.click();await expect(favorite).toHaveAttribute('aria-pressed','true');
 await page.getByLabel('只看已收藏').check();await favorite.click();await expect(page.getByRole('button',{name:'自阻力划船',exact:true})).toHaveCount(0);
 await page.reload();await page.getByLabel('只看已收藏').check();await expect(page.getByRole('button',{name:'自阻力划船',exact:true})).toHaveCount(0);
 await page.getByLabel('只看已收藏').uncheck();await page.getByRole('searchbox').fill('自阻力划船');await expect(page.getByRole('button',{name:'收藏 自阻力划船',exact:true})).toHaveAttribute('aria-pressed','false');
});

test('cached deletion and recovery entries remain offline and after 90 seconds in background',async({page,context})=>{
 await createPlan(page);await page.goto('/plans');await page.clock.install();
 await expect(page.getByRole('button',{name:'不再使用这份计划',exact:true})).toBeVisible();
 await context.setOffline(true);
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'hidden'});document.dispatchEvent(new Event('visibilitychange'));});
 await page.clock.fastForward(90000);
 await expect(page.getByRole('button',{name:'不再使用这份计划',exact:true})).toBeVisible();
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{configurable:true,get:()=> 'visible'});document.dispatchEvent(new Event('visibilitychange'));});
 await page.getByRole('button',{name:'不再使用这份计划',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认删除',exact:true}).click();
 await expect(page.getByText('已删除计划',{exact:true})).toBeVisible();await expect(page.getByRole('dialog')).not.toBeVisible();
 await page.evaluate(()=>{history.pushState(null,'','/settings');window.dispatchEvent(new PopStateEvent('popstate'));});
 await page.getByRole('button',{name:'已删除的计划',exact:true}).click();await expect(page.getByRole('button',{name:'恢复',exact:true})).toBeVisible();
 await page.clock.fastForward(90000);await expect(page.getByRole('button',{name:'恢复',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'恢复',exact:true}).click();await expect.poll(async()=>(await records(page)).plans[0].deletedAt).toBeUndefined();
 await context.setOffline(false);await page.unroute('**/api/v1/features');await page.route('**/api/v1/features',route=>route.abort());
 await page.reload();await expect(page.getByRole('button',{name:'已删除的计划',exact:true})).toBeVisible();
});

test('reuse requires confirmation when replacing current, preserves records and keeps the former current in previous plans',async({page})=>{
 await createPlan(page);const first=await records(page);await draft(page,'第二份训练计划');await page.getByRole('button',{name:'就用这份计划',exact:true}).click();await expect(page.getByRole('heading',{name:'今天',exact:true})).toBeVisible();const before=await records(page);
 await page.goto('/plans');await page.getByRole('button',{name:'重新使用',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('当前计划会移到以前的计划');expect((await records(page)).state.currentPlanId).toBe(before.state.currentPlanId);
 await page.keyboard.press('Escape');expect((await records(page)).state.currentPlanId).toBe(before.state.currentPlanId);await page.getByRole('button',{name:'重新使用',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'确认使用',exact:true}).click();await expect.poll(async()=>(await records(page)).state.currentPlanId).toBe(first.state.currentPlanId);const after=await records(page);expect(after.workouts).toEqual(before.workouts);expect(after.versions).toEqual(before.versions);expect(after.plans.find((p:any)=>p.id===before.state.currentPlanId).readOnly).toBe(true);
});
test('restored plan can be reused without a current plan and exercise guide restores its actual trigger',async({page})=>{
 await createPlan(page);const first=await records(page);await removeCurrentPlan(page);await page.goto('/settings');await page.getByRole('button',{name:'已删除的计划',exact:true}).click();await page.getByRole('button',{name:'恢复',exact:true}).click();await expect.poll(async()=>(await records(page)).plans[0].deletedAt).toBeUndefined();await page.goto('/plans');await page.getByRole('button',{name:'重新使用',exact:true}).click();await expect.poll(async()=>(await records(page)).state.currentPlanId).toBe(first.state.currentPlanId);await expect(page.getByRole('dialog')).toHaveCount(0);
 const trigger=page.locator('.plan-items button').first();await page.locator('.plan-actions button').first().focus();await trigger.evaluate((el:HTMLElement)=>el.click());await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');await expect(trigger).toBeFocused();
});
