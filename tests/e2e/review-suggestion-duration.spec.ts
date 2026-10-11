import {test,expect} from '@playwright/test';

test('month facts use the month while suggestions retain the approved recent-week window and actual duration',async({page})=>{
 await page.clock.install({time:new Date('2026-10-25T04:00:00Z')});
 await page.goto('/');await page.getByLabel('你的回答').fill('保持力量');await page.getByRole('button',{name:'继续',exact:true}).click();
 await page.getByLabel('你的回答').fill('每周3次，每次30分钟');await page.getByRole('button',{name:'继续',exact:true}).click();
 await page.getByLabel('你的回答').fill('在家，只有瑜伽垫');await page.getByRole('button',{name:'继续',exact:true}).click();
 await page.getByLabel('我已年满 18 岁',{exact:false}).check();await page.getByRole('button',{name:'生成我的第一版计划'}).click();await page.getByRole('button',{name:'就用这份计划'}).click();
 await expect(page.getByRole('heading',{name:'下一次',exact:true})).toBeVisible();
 const seed=async(days:number[])=>page.evaluate(async days=>{
  const rp='/src/persistence/repository.ts';const {repository}=await import(/* @vite-ignore */ rp);
  const state=await repository.db.v8State.get('v8'),plan=await repository.db.v8Plans.get(state.currentPlanId),version=await repository.db.v8PlanVersions.get(plan.currentVersionId),template=version.templates[0];
  await repository.db.v8Workouts.bulkAdd(days.map(day=>{const date=`2026-10-${String(day).padStart(2,'0')}`;return {id:crypto.randomUUID(),planVersionId:version.id,templateId:template.id,startedAt:`${date}T04:00:00Z`,endedAt:`${date}T04:05:00Z`,localDate:date,timeZone:'Asia/Shanghai',status:'partial',plannedSetCount:template.items.reduce((n:any,i:any)=>n+i.sets,0),sets:[{exerciseId:template.items[0].exerciseId,itemIndex:0,setIndex:0,reps:8,completedAt:`${date}T04:01:00Z`}],feedback:{reasons:['time']}};}));
  return JSON.stringify(version);
 },days);
 const original=await seed([5,6]);await page.goto('/review');await page.getByRole('button',{name:'本月回顾',exact:true}).click();
 await expect(page.getByText('这个月你动了 2 次。',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'就这样调整',exact:true})).toHaveCount(0);
 await seed([20,21]);await page.reload();await page.getByRole('button',{name:'本月回顾',exact:true}).click();
 await expect(page.getByText('这个月你动了 4 次。',{exact:true})).toBeVisible();await expect(page.getByText('工作日那次，换成 15 分钟的短训练。',{exact:true}).first()).toBeVisible();
 await page.getByRole('button',{name:'就这样调整',exact:true}).click();await expect(page.getByRole('heading',{name:'15 分钟 · 15'})).toBeVisible();
 const saved=await page.evaluate(async()=>{const rp='/src/persistence/repository.ts';const {repository}=await import(/* @vite-ignore */ rp);return JSON.stringify((await repository.db.v8PlanVersions.toArray())[0]);});expect(saved).toBe(original);
});
