import { test, expect, type Page } from '@playwright/test';
async function plan(page:Page){
 await page.goto('/');await page.getByLabel('你的回答').fill('保持力量');await page.getByRole('button',{name:'继续',exact:true}).click();
 await page.getByLabel('你的回答').fill('每周3次，每次30分钟');await page.getByRole('button',{name:'继续',exact:true}).click();
 await page.getByLabel('你的回答').fill('在家，只有瑜伽垫');await page.getByRole('button',{name:'继续',exact:true}).click();
 await page.getByLabel('我已年满 18 岁',{exact:false}).check();await page.getByRole('button',{name:'生成我的第一版计划'}).click();await page.getByRole('button',{name:'就用这份计划'}).click();
}
test('plan details morph from a chip, preserve read-only versions, and restore keyboard focus',async({page})=>{
 await plan(page);await page.goto('/plans');const chip=page.locator('.plan-items button').first();await chip.click();
 const dialog=page.getByRole('dialog');await expect(dialog).toBeVisible();await expect(dialog.locator('ol li').first()).toBeVisible();
 for(const width of [390,1440]){await page.setViewportSize({width,height:844});await dialog.evaluate(async element=>{await Promise.all(element.getAnimations().map(a=>a.finished));});await page.screenshot({path:`tests/fixtures/v8-plan-review/qingci-${width}.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();await expect(chip).toBeFocused();
 await page.getByRole('button',{name:'查看以前的版本'}).click();await expect(page.getByRole('heading',{name:'计划版本',exact:true})).toBeVisible();await page.getByRole('button',{name:'查看计划',exact:true}).first().click();await expect(page.getByRole('heading',{name:'我的计划'})).toBeVisible();
});
test('library details share modal behavior and favorites survive reload',async({page})=>{
 await plan(page);await page.goto('/exercises');await page.getByLabel('搜索动作').fill('自阻力划船');
 const movement=page.getByRole('button',{name:'自阻力划船',exact:true});await movement.click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'关闭',exact:true}).click();await expect(page.getByRole('dialog')).not.toBeVisible();await expect(movement).toBeFocused();
 await page.getByRole('button',{name:'收藏 自阻力划船',exact:true}).click();await page.reload();await page.getByLabel('只看已收藏').check();await expect(page.getByRole('button',{name:'自阻力划船',exact:true})).toBeVisible();
});

async function timeEvidence(page:Page){
 return page.evaluate(async()=>{
  const dp='/src/persistence/db.ts',ap='/src/application/v8-activity.ts';const db=(await import(/* @vite-ignore */ dp)).database;const {activityDate}=await import(/* @vite-ignore */ ap);
  const version=(await db.v8PlanVersions.toArray())[0],date=activityDate('Asia/Shanghai');const item=version.templates[0].items[0];
  const rows=[0,1].map(i=>({id:crypto.randomUUID(),planVersionId:version.id,templateId:version.templates[0].id,startedAt:`${date}T0${i+2}:00:00Z`,endedAt:`${date}T0${i+2}:10:00Z`,localDate:date,timeZone:'Asia/Shanghai',status:'partial',plannedSetCount:8,sets:[{exerciseId:item.exerciseId,itemIndex:0,setIndex:0,reps:8,completedAt:`${date}T0${i+2}:01:00Z`}],feedback:{reasons:['time']}}));
  await db.v8Workouts.bulkAdd(rows);return {version,rows};
 });
}
test('monthly facts remain visible and adopting a preview adds a version without changing workout facts',async({page})=>{
 await plan(page);const before=await timeEvidence(page);await page.goto('/review');await page.getByRole('button',{name:'本月回顾',exact:true}).click();
 await expect(page.locator('.v8-facts dd')).toHaveText(['0','2','2','20','0']);
 await expect(page.locator('.v8-month-chart')).toBeVisible();expect(await page.locator('.v8-month-column').count()).toBeGreaterThanOrEqual(4);
 await page.getByRole('button',{name:'就这样调整',exact:true}).click();await expect(page.getByRole('heading',{name:'核对调整后的计划'})).toBeVisible();await page.getByRole('button',{name:'就这样调整',exact:true}).click();
 await expect(page.getByRole('status')).toHaveText('已保存为新的计划版本。');
 const after=await page.evaluate(async()=>{const p='/src/persistence/db.ts',db=(await import(/* @vite-ignore */ p)).database;return {versions:await db.v8PlanVersions.toArray(),rows:await db.v8Workouts.toArray()};});
 expect(after.versions).toHaveLength(2);expect(after.versions.find((v:{id:string})=>v.id===before.version.id)).toEqual(before.version);expect(after.rows).toEqual(expect.arrayContaining(before.rows));
 expect(after.versions.find((v:{id:string})=>v.id!==before.version.id).templates.some((t:{id:string})=>t.id==='review-short')).toBe(true);
});
test('declining a suggestion suppresses it after reload for the same week',async({page})=>{
 await plan(page);await timeEvidence(page);await page.goto('/review');await page.getByRole('button',{name:'先不改',exact:true}).click();await page.reload();await expect(page.getByRole('button',{name:'就这样调整',exact:true})).toHaveCount(0);
});
