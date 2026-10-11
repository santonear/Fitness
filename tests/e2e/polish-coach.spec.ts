import {test,expect} from '@playwright/test';
test('missing plan uses conservative local pain response and review navigation without network',async({page})=>{
 let calls=0;await page.route('**/api/v1/plans/generate',async route=>{calls++;await route.abort();});
 await page.goto('/tests/fixtures/v8-coach/index.html?missing');await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();
 await page.getByRole('textbox',{name:'跟芽芽说'}).fill('膝盖痛');await page.getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.getByText('如果疼痛明显或持续，先休息，并请专业人士看看',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'确认应用'})).toHaveCount(0);
 await page.getByRole('textbox',{name:'跟芽芽说'}).fill('想看看这周');await page.getByRole('button',{name:'发送',exact:true}).click();
 await page.getByRole('button',{name:'查看本地回顾'}).last().click();await expect(page.getByText('本周回顾已打开')).toBeVisible();expect(calls).toBe(0);
});
test('qualification failure produces a confirmable local short plan without a second model call',async({page})=>{
 let calls=0,applies=0;await page.route('**/api/v1/plans/generate',async route=>{calls++;await route.fulfill({status:403,json:{error:'QUALIFICATION_REQUIRED'}});});
 await page.route('**/fixture/apply',async route=>{applies++;await route.fulfill({status:200,body:'saved'});});
 await page.goto('/tests/fixtures/v8-coach/index.html?local-adjust&apply-test');await page.getByRole('button',{name:'跟芽芽说',exact:true}).click();
 await page.getByRole('textbox',{name:'跟芽芽说'}).fill('今天时间不够');await page.getByRole('button',{name:'发送',exact:true}).click();
 await expect(page.getByText('可以试试这份约 15 分钟的短版，只改今天。',{exact:true})).toBeVisible();expect(applies).toBe(0);
 await page.getByRole('button',{name:'确认应用'}).click();await expect(page.getByText('已保存',{exact:true})).toBeVisible();expect(applies).toBe(1);expect(calls).toBe(1);
});
test('review has one factual feature card and finish includes elapsed time and partial sessions in its ordinal',async({page})=>{
 await page.goto('/');await page.getByLabel('你的回答').fill('保持力量');await page.getByRole('button',{name:'继续',exact:true}).click();
 await page.getByLabel('你的回答').fill('每周3次，每次30–45分钟');await page.getByRole('button',{name:'继续',exact:true}).click();
 await page.getByLabel('你的回答').fill('在家，只有瑜伽垫');await page.getByRole('button',{name:'继续',exact:true}).click();
 await page.getByLabel('我已年满 18 岁',{exact:false}).check();await page.getByRole('button',{name:'生成我的第一版计划'}).click();await page.getByRole('button',{name:'就用这份计划'}).click();
 await expect(page.getByRole('heading',{name:'下一次',exact:true})).toBeVisible();
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
 await page.getByRole('button',{name:'记下来',exact:true}).click();await expect(page.locator('[data-context="review"]')).toHaveCount(1);await expect(page.getByText('这周你动了 1 次。',{exact:true})).toBeVisible();await expect(page.getByText('完成了 0 次，部分完成 1 次，还差 3 次。',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'本月回顾',exact:true}).click();await expect(page.getByText('这个月你动了 1 次。',{exact:true})).toBeVisible();await expect(page.locator('[data-context="review"]')).toHaveCount(1);
 for(const width of [390,1440]){await page.setViewportSize({width,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:`outputs/polish-coach/review-${width}.png`,fullPage:true});}
});
