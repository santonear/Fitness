import {test,expect} from '@playwright/test';
import {EXERCISE_IDS} from '../../src/catalog/exercise-ids';
test('explicit send omits optional data, validates response, and keeps draft when closed',async({page})=>{
 let sent:any;
 await page.route('**/api/v1/plans/generate',async route=>{sent=route.request().postDataJSON();await route.fulfill({json:{requestId:sent.requestId,context:{restoreGeneration:0,inputDigest:sent.sendConfirmation},accounting:'settled',result:{requestId:sent.requestId,restoreGeneration:0,mutationAllowed:false,type:'clarify',question:'想在哪里练？'}}});});
 await page.goto('/tests/fixtures/v8-coach/index.html');await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();
 await page.getByRole('textbox',{name:'跟芽芽说'}).fill('想在家练');await page.getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.getByText('想在哪里练？')).toBeVisible();expect(sent.coach.body).toBeUndefined();expect(sent.coach.history).toBeUndefined();
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();await expect(page.getByRole('textbox',{name:'跟芽芽说'})).toHaveValue('想在家练');await expect(page.getByText('想在哪里练？')).toBeVisible();
});
for(const width of [390,1440])test(`coach qingci ${width}`,async({page})=>{await page.setViewportSize({width,height:844});await page.goto('/tests/fixtures/v8-coach/index.html');await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();await page.waitForTimeout(600);await page.screenshot({path:`outputs/v8-coach/qingci-${width}.png`});});
test('qualification denial offers an actionable local plan without another request',async({page})=>{
 let calls=0;await page.route('**/api/v1/plans/generate',async route=>{calls++;await route.fulfill({status:403,json:{error:'QUALIFICATION_REQUIRED'}});});
 await page.goto('/tests/fixtures/v8-coach/index.html');await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();await page.getByRole('textbox',{name:'跟芽芽说'}).fill('想在家练');await page.getByRole('button',{name:'发送',exact:true}).click();await page.getByRole('button',{name:'使用基础计划'}).click();await expect(page.getByText('基础计划入口已打开')).toBeVisible();expect(calls).toBe(1);
});
test('legacy profile without coach details still offers local planning',async({page})=>{await page.goto('/tests/fixtures/v8-coach/index.html?missing');await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();await page.getByRole('button',{name:'使用基础计划'}).click();await expect(page.getByText('基础计划入口已打开')).toBeVisible();});
test('candidate preview shows repetitions load duration and distance before confirmation',async({page})=>{
 await page.route('**/api/v1/plans/generate',async route=>{const sent=route.request().postDataJSON(),p=sent.coach.profile;
  const items=[{exerciseId:EXERCISE_IDS.gobletSquat,equipment:'dumbbell',sets:2,target:{metricType:'reps_load',reps:8,loadGrams:12500}},{exerciseId:EXERCISE_IDS.walking,equipment:'none',sets:1,target:{metricType:'duration_distance',durationSeconds:600,distanceMeters:750}},{exerciseId:EXERCISE_IDS.bodyweightSquat,equipment:'none',sets:3,target:{metricType:'reps',reps:10}},{exerciseId:EXERCISE_IDS.plank,equipment:'none',sets:2,target:{metricType:'duration',durationSeconds:25}}];
  await route.fulfill({json:{requestId:sent.requestId,context:{restoreGeneration:0,inputDigest:sent.sendConfirmation},accounting:'settled',result:{requestId:sent.requestId,restoreGeneration:0,mutationAllowed:false,type:'plan_proposal',proposal:{goalText:p.goalText,weeklyTarget:p.weeklyTarget,sessionMinutes:p.sessionMinutes,scheduleOriginalText:p.scheduleOriginalText,reasons:['a','b','c'],templates:[{id:'A',name:'A',estimatedMinutes:20,items},{id:'B',name:'B',estimatedMinutes:20,items}]}}}});
 });
 await page.goto('/tests/fixtures/v8-coach/index.html');await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();await page.getByRole('textbox',{name:'跟芽芽说'}).fill('帮我看看');await page.getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.getByText('高脚杯深蹲 · 2 组 · 8 次 · 12.5 kg').first()).toBeVisible();await expect(page.getByText('步行 · 1 组 · 600 s · 0.75 km').first()).toBeVisible();await expect(page.getByText('徒手深蹲 · 3 组 · 10 次').first()).toBeVisible();await expect(page.getByText('平板支撑 · 2 组 · 25 s').first()).toBeVisible();
});
