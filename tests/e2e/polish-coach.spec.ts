import {test,expect} from '@playwright/test';
import {showShared} from './helpers/home-coach';
import {answerTexts,basicSafety,confirmReplan,generate,startOnboarding,toFirstQuestion} from './helpers/onboarding-v9';
test('missing plan uses conservative local pain response and review navigation without network',async({page})=>{
 let calls=0;await page.route('**/api/v1/plans/generate',async route=>{calls++;await route.abort();});
 await page.goto('/tests/fixtures/v8-coach/index.html?missing');await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();
 await page.getByRole('textbox').fill('膝盖痛');await page.getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.getByRole('log')).toContainText('如果疼痛明显或持续，先休息，并请专业人士看看');
 await expect(page.getByRole('log')).toContainText('可以先停下不舒服的动作。可以试试蚌式开合。');
 await expect(page.getByText('现在用的是本地建议',{exact:false})).toBeVisible();
 await expect(page.getByRole('button',{name:'应用建议'})).toHaveCount(0);
 await page.getByRole('textbox').fill('想看看这周');await page.getByRole('button',{name:'发送',exact:true}).click();
 await page.getByRole('button',{name:'查看本地回顾'}).last().click();await expect(page.getByText('本周回顾已打开')).toBeVisible();expect(calls).toBe(0);
});
test.beforeEach(async({page})=>{await page.route('**/api/v1/trial/access-status',async route=>{await route.fulfill({json:{qualification:'active',sessionValid:true,expiresAt:Date.now()+60000,aiEnabled:true}});});});
test('qualification failure produces a confirmable local short plan without a second model call',async({page})=>{
 await page.route('**/api/v1/features',r=>r.fulfill({json:{version:1,flags:{aiAssistantV2:true},expiresAt:Date.now()+60000}}));
 let calls=0,applies=0;await page.route('**/api/v1/assistant/chat',async route=>{calls++;await route.fulfill({status:403,json:{error:'QUALIFICATION_REQUIRED'}});});
 await page.route('**/fixture/apply',async route=>{applies++;await route.fulfill({status:200,body:'saved'});});
 await page.goto('/tests/fixtures/v8-coach/index.html?local-adjust&apply-test');
 await page.evaluate(async()=>{const p='/src/application/feature-flags.ts';await(await import(/* @vite-ignore */ p)).refreshFeatureFlags(async()=>Response.json({version:1,flags:{aiAssistantV2:true},expiresAt:Date.now()+60000}));});
 await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();
 await page.getByRole('textbox').fill('今天时间不够');await page.getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.getByRole('log')).toContainText('可以试试这份约 15 分钟的短版，只改今天。');expect(applies).toBe(0);
 await page.getByRole('button',{name:'应用建议'}).click();await expect(page.getByText('已应用',{exact:true})).toBeVisible();expect(applies).toBe(1);expect(calls).toBe(1);
});
for(const status of ['none','unknown','offline'])test(`access ${status} returns a local short plan with zero generate requests`,async({page})=>{
 let generationCalls=0,accessCalls=0;
 await page.route('**/api/v1/trial/access-status',async route=>{accessCalls++;expect(route.request().postDataJSON()).toEqual({});if(status==='offline')await route.abort();else await route.fulfill({json:status==='none'?{qualification:'none',sessionValid:false}:{qualification:'unknown',sessionValid:false}});});
 await page.route('**/api/v1/plans/generate',async route=>{generationCalls++;await route.abort();});
 await page.goto('/tests/fixtures/v8-coach/index.html?local-adjust');await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();
 await page.getByRole('textbox').fill('今天时间不够');await page.getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.getByRole('log')).toContainText('可以试试这份约 15 分钟的短版，只改今天。');await expect(page.getByRole('button',{name:'应用建议'})).toBeVisible();expect(accessCalls).toBe(1);expect(generationCalls).toBe(0);
 await expect(page.getByText('现在用的是本地建议',{exact:false})).toBeVisible();await expect(page.getByText('芽芽暂时连不上，你的记录不受影响',{exact:true})).toHaveCount(0);
});
test('review has one factual feature card and finish includes elapsed time and partial sessions in its ordinal',async({page})=>{
 await startOnboarding(page);await answerTexts(page,['保持力量']);
 await answerTexts(page,['每周3次，每次30–45分钟']);
 await answerTexts(page,['在家，只有瑜伽垫']);
 await basicSafety(page);await generate(page);await page.getByRole('button',{name:'就用这份计划'}).click();
 await expect(page.getByRole('heading',{name:'今天',exact:true})).toBeVisible();
 const activeId=await page.evaluate(async()=>{
  const rp='/src/persistence/repository.ts',wp='/src/application/v8-workflow.ts',ep='/src/catalog/exercises.ts';
  const {repository}=await import(/* @vite-ignore */ rp),{createV8Workflow}=await import(/* @vite-ignore */ wp),{EXERCISE_IDS}=await import(/* @vite-ignore */ ep);
  const flow=createV8Workflow(repository),snapshot=await flow.snapshot();
  const planned=await flow.start(snapshot.version.templates[0].id);await flow.recordSet(planned.id,0,0,{reps:8});await flow.finish(planned.id,{reasons:['time']});
  const prior=await flow.start(undefined,EXERCISE_IDS.bodyweightSquat);
  await flow.recordSet(prior.id,0,0,{reps:8});await flow.finish(prior.id,{reasons:['time']});
  const current=await flow.start(undefined,EXERCISE_IDS.bodyweightSquat);await flow.recordSet(current.id,0,0,{reps:8});
  await repository.db.v8Workouts.update(current.id,{startedAt:new Date(Date.now()-7*60000).toISOString()});return current.id;
 });
 await page.goto(`/workout/${activeId}/finish`);await expect(page.getByText('本次用时 7 分钟',{exact:true})).toBeVisible();await expect(page.getByText('这是你本周第 3 次训练。',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'记下来',exact:true}).click();await expect(page.locator('[data-context="review"]')).toHaveCount(1);await expect(page.locator('.rv-tiles dd').first()).toHaveText('3');await expect(page.getByRole('progressbar',{name:'本周目标 3 次，已练 1 次（1 次练了一部分），还可以再练 2 次。',exact:true})).toBeVisible();await expect(page.getByText(/还差/)).toHaveCount(0);
 await page.getByRole('radio',{name:'本月',exact:true}).click();await expect(page.getByRole('heading',{name:'本月回顾',exact:true})).toBeVisible();await expect(page.locator('.rv-tiles dd').first()).toHaveText('3');await expect(page.locator('[data-context="review"]')).toHaveCount(1);
 for(const width of [390,1440]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`outputs/polish-coach/review-${width}.png`,fullPage:true});}
});

test('week and month reviews without a current plan retain facts and offer manual or new planning',async({page})=>{
 await page.goto('/onboarding');await toFirstQuestion(page);
 await answerTexts(page,['保持力量','每周3次，每次30分钟','在家，只有瑜伽垫']);
 await basicSafety(page);await generate(page);await page.getByRole('button',{name:'就用这份计划',exact:true}).click();
 await expect(page.getByRole('heading',{name:'今天',exact:true})).toBeVisible();
 await page.evaluate(async()=>{const rp='/src/persistence/repository.ts',wp='/src/application/v8-workflow.ts';const {repository}=await import(/* @vite-ignore */ rp),{createV8Workflow}=await import(/* @vite-ignore */ wp);const flow=createV8Workflow(repository),s=await flow.snapshot();const w=await flow.start(s.version.templates[0].id);await flow.recordSet(w.id,0,0,{reps:8});await flow.finish(w.id,{reasons:['time']});});
 await page.goto('/review');await expect(page.locator('.rv-facts dd')).toHaveCount(5);const before=await page.locator('.rv-facts dd').allTextContents();
 await page.evaluate(async()=>{const rp='/src/persistence/repository.ts',wp='/src/application/v8-workflow.ts';const {repository}=await import(/* @vite-ignore */ rp),{createV8Workflow}=await import(/* @vite-ignore */ wp);const flow=createV8Workflow(repository),s=await flow.snapshot();await flow.deletePlan(s.plan.id,s.metadata.dataRevision);});
 await page.reload();
 for(const kind of ['本周','本月']){await page.getByRole('radio',{name:kind,exact:true}).click();await expect(page.locator('.rv-facts dd')).toHaveText(before);await expect(page.getByText(/还差.*次|按现在的计划继续/)).toHaveCount(0);await expect(page.getByRole('progressbar',{name:'完成了 0 次，部分完成 1 次。',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'手动训练',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'重新制定计划',exact:true})).toBeVisible();}
 await page.getByRole('button',{name:'手动训练',exact:true}).click();await expect(page).toHaveURL(/\/manual$/);await page.goto('/review');await page.getByRole('button',{name:'重新制定计划',exact:true}).click();await confirmReplan(page);await expect(page).toHaveURL(/\/onboarding$/);
});

test('coach consent shows a repeated instruction once and a readable time zone while retaining raw fields',async({page})=>{
 await page.goto('/tests/fixtures/v8-coach/index.html?local-adjust');await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();
 await page.getByRole('textbox').fill('今天时间不够');
 const panel=page.getByRole('dialog');await showShared(page);await panel.getByText('查看发送内容',{exact:true}).click();
 await expect(panel.locator('dd:visible').filter({hasText:'今天时间不够'})).toHaveCount(1);
 await expect(panel.getByText('东八区（UTC+8）',{exact:true})).toBeVisible();
 await expect(panel).not.toContainText('Asia/Shanghai');
 await expect(panel).not.toContainText('11111111-1111-4111-8111-111111111111');
 await expect(panel).not.toContainText('revision');
 await expect(panel.locator('dd:visible').filter({hasText:'今天时间不够'})).toHaveCount(1);
});
