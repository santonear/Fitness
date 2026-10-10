import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function onboard(page: Page, caution?: string) {
  await page.goto('/'); await expect(page).toHaveURL(/onboarding/);
  await page.getByLabel('你的回答').fill('想有些力量，不再容易累'); await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByLabel('你的回答').fill('每周 2 次，每次 20 分钟'); await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByLabel('你的回答').fill('在家，只有瑜伽垫'); await page.getByRole('button', { name: '继续', exact: true }).click();
  if (caution) await page.getByRole('button', { name: caution, exact: true }).click();
  await page.getByLabel('我已年满 18 岁').check(); await page.getByRole('button', { name: '生成我的第一版计划' }).click();
  await expect(page.getByRole('heading', { name: '你的第一版计划' })).toBeVisible();
}
test('real local mainline persists a confirmed plan, training and review with no model requests', async ({ page }) => {
  let calls = 0; page.on('request', request => { if (request.url().includes('/api/')) calls++; });
  await onboard(page);
  expect(await page.evaluate(async () => { const p = '/src/persistence/db.ts'; return (await import(/* @vite-ignore */ p)).database.v8Plans.count(); })).toBe(0);
  await page.getByRole('button', { name: '就用这份计划' }).click();
  await expect(page.getByRole('heading', { name: '下一次' })).toBeVisible();
  await page.screenshot({ path: 'tests/fixtures/v8-mainline/qingci-390.png', fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.screenshot({ path: 'tests/fixtures/v8-mainline/qingci-1440.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: '开始训练', exact: true }).first().click();
  await page.getByRole('button', { name: '完成这一组', exact: true }).click();
  await expect(page.getByText('第 2 组，共 2 组', { exact: true })).toBeVisible();
  await page.reload(); await expect(page.getByText('第 2 组，共 2 组', { exact: true })).toBeVisible();
  await page.goto('/settings/appearance'); await page.getByRole('button', { name: '留白', exact: true }).click();
  await page.getByRole('button', { name: '青瓷', exact: true }).click();
  await page.goto('/'); await page.getByRole('button', { name: '正在进行，点这里回到训练' }).click();
  await expect(page.getByText('第 2 组，共 2 组', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '暂停或结束' }).click();
  await page.getByRole('button', { name: '结束并记下', exact: true }).click();
  await page.getByRole('button', { name: '时间不够', exact: true }).click(); await page.getByLabel('想补充一句（可不填）').fill('今天先记一组');
  await page.getByRole('button', { name: '记下来', exact: true }).click();
  await expect(page.getByRole('heading', { name: '本周回顾' })).toBeVisible();
  await expect(page.getByText('今天先记一组', { exact: true })).toBeVisible();  const record = await page.evaluate(async () => { const p = '/src/persistence/db.ts'; const db = (await import(/* @vite-ignore */ p)).database; return { workouts: await db.v8Workouts.toArray(), versions: await db.v8PlanVersions.toArray() }; });
  expect(record.workouts[0].status).toBe('partial'); expect(record.workouts[0].sets).toHaveLength(1);
  expect(record.versions[0].sessionMinutes).toBe(20); expect(record.workouts[0].planVersionId).toBe(record.versions[0].id); expect(calls).toBe(0);
});
test('onboarding is resumable and adult confirmation is required for basic generation', async ({ page }) => {
  await page.goto('/'); await page.getByLabel('你的回答').fill('保持活动'); await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByLabel('你的回答').fill('每周 3 次，每次 30 分钟'); await page.reload();
  await expect(page.getByLabel('你的回答')).toHaveValue('每周 3 次，每次 30 分钟');
  await page.getByRole('button', { name: '继续', exact: true }).click(); await page.getByLabel('你的回答').fill('在家'); await page.getByRole('button', { name: '继续', exact: true }).click();
  await expect(page.getByRole('button', { name: '生成我的第一版计划' })).toBeDisabled();
});


test('one focused exercise, edited defaults, replacement and pause retain facts',async({page})=>{
 await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();
 await expect(page.getByRole('button',{name:'开始训练',exact:true})).toHaveCount(1);
 await page.getByRole('button',{name:'换一份',exact:true}).click();await page.getByRole('button',{name:'开始训练',exact:true}).click();
 await page.getByRole('button',{name:'修改数值'}).click();await page.getByLabel('次',{exact:true}).fill('9');await page.getByRole('button',{name:'确定',exact:true}).click();
 await page.getByRole('button',{name:'完成这一组'}).click();await expect(page.getByText('第 2 组，共 2 组',{exact:true})).toBeVisible();
 await page.getByRole('button',{name:'换动作',exact:true}).click();await page.getByLabel('替换动作',{exact:true}).selectOption({label:'自阻力划船'});await page.getByLabel('换动作的原因').selectOption('discomfort');await page.getByRole('button',{name:'确定',exact:true}).click();
 await expect(page.getByRole('heading',{name:'自阻力划船',exact:true})).toBeVisible();await page.getByRole('button',{name:'完成这一组'}).click();
 await expect(page.getByRole('button',{name:'这个动作完成了，换下一个'})).toBeVisible();
 const result=await page.evaluate(async()=>{const p='/src/persistence/db.ts';const db=(await import(/* @vite-ignore */ p)).database;return (await db.v8Workouts.toArray())[0];});
 expect(result.sets[0].reps).toBe(9);expect(result.sets[0].exerciseId).not.toBe(result.sets[1].exerciseId);expect(result.substitutions[0].reason).toBe('discomfort');
 await page.getByRole('button',{name:'暂停或结束'}).click();await expect(page.getByRole('button',{name:'继续训练',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'结束并记下',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'放弃这次（不计入回顾）'})).toBeVisible();
});

test('cautions produce a draft instead of redirecting to manual training',async({page})=>{
 await onboard(page,'膝盖');await expect(page.getByRole('button',{name:'就用这份计划'})).toBeEnabled();
 await expect(page.getByText('已按你选择的注意部位排除相关负担动作；这不是医疗适用性判断。')).toBeVisible();
 await page.getByRole('button',{name:'就用这份计划'}).click();await expect(page.getByRole('heading',{name:'下一次'})).toBeVisible();
});

test('responsive navigation leaves all home actions clickable and activities persist independently',async({page})=>{
 await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();
 for(const width of [320,390,959,960,1440]) {
  await page.setViewportSize({width,height:844});
  const nav=page.locator('.v8-shell > nav'); const rect=await nav.boundingBox();
  if(width>=960){expect(rect!.x).toBe(0);expect(rect!.width).toBe(88);}else expect(rect!.width).toBeLessThanOrEqual(width);
  for(const label of ['换一份','手动训练','记录其他活动']) {
   const button=page.getByRole('button',{name:label,exact:true});await button.scrollIntoViewIfNeeded();
   await button.click({trial:true});
   const box=await button.boundingBox(),bar=await nav.boundingBox();
   if(width<960)expect(box!.y+box!.height).toBeLessThanOrEqual(bar!.y);
  }
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 }
 await page.getByRole('button',{name:'记录其他活动',exact:true}).click();
 await page.getByRole('button',{name:'骑行',exact:true}).click();await page.getByLabel('时长（分钟）').fill('5');
 await expect(page.getByRole('button',{name:'减少 10 分钟'})).toBeDisabled();
 await page.getByRole('button',{name:'增加 10 分钟'}).click();await page.getByLabel('想补充一句（可不填）').fill('公园骑行');
 await page.getByRole('button',{name:'记下来',exact:true}).click();await expect(page.getByText('公园骑行',{exact:true})).toBeVisible();await page.reload();await expect(page.getByText('公园骑行',{exact:true})).toBeVisible();
 const saved=await page.evaluate(async()=>{const p='/src/persistence/db.ts';const db=(await import(/* @vite-ignore */ p)).database;return {activities:await db.v8Activities.toArray(),workouts:await db.v8Workouts.count(),versions:await db.v8PlanVersions.count()};});
 expect(saved.activities).toHaveLength(1);expect(saved.activities[0]).toMatchObject({type:'cycle',minutes:15});expect(saved.workouts).toBe(0);expect(saved.versions).toBe(1);
 await page.goto('/plans');await expect(page.getByRole('heading',{name:'我的计划',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'查看以前的版本'}).click();await expect(page.getByRole('heading',{name:'计划版本',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'查看计划',exact:true}).click();await expect(page.getByRole('heading',{name:'我的计划',exact:true})).toBeVisible();
});

test('review adjustment is previewed then saved as a new version without rewriting facts',async({page})=>{
 await onboard(page);await page.getByRole('button',{name:'就用这份计划'}).click();
 for(let i=0;i<2;i++){
  await page.getByRole('button',{name:'开始训练',exact:true}).click();await page.getByRole('button',{name:'完成这一组'}).click();
  await page.getByRole('button',{name:'暂停或结束'}).click();await page.getByRole('button',{name:'结束并记下',exact:true}).click();
  await page.getByRole('button',{name:'时间不够',exact:true}).click();await page.getByRole('button',{name:'记下来',exact:true}).click();
  await expect(page.getByRole('heading',{name:'本周回顾',exact:true})).toBeVisible();
  if(i===0)await page.getByRole('button',{name:'下一次',exact:true}).click();
 }
 const before=await page.evaluate(async()=>{const p='/src/persistence/db.ts';const db=(await import(/* @vite-ignore */ p)).database;return {workouts:await db.v8Workouts.toArray(),versions:await db.v8PlanVersions.toArray()};});
 await page.getByRole('button',{name:'就这样调整',exact:true}).click();await expect(page.getByRole('heading',{name:'核对调整后的计划'})).toBeVisible();
 expect(await page.evaluate(async()=>{const p='/src/persistence/db.ts';return (await import(/* @vite-ignore */ p)).database.v8PlanVersions.count();})).toBe(1);
 await page.getByRole('button',{name:'就这样调整',exact:true}).click();await expect(page.getByRole('status')).toHaveText('已保存为新的计划版本。');
 const after=await page.evaluate(async()=>{const p='/src/persistence/db.ts';const db=(await import(/* @vite-ignore */ p)).database;return {workouts:await db.v8Workouts.toArray(),versions:await db.v8PlanVersions.toArray()};});
 expect(after.workouts).toEqual(before.workouts);expect(after.versions).toHaveLength(2);expect(after.versions.find((v:{id:string})=>v.id===before.versions[0].id)).toEqual(before.versions[0]);
 await page.getByRole('button',{name:'本月回顾',exact:true}).click();await expect(page.getByRole('heading',{name:'本月回顾',exact:true})).toBeVisible();
 await page.goto('/plans/versions');await expect(page.getByRole('button',{name:'查看计划',exact:true})).toHaveCount(2);
});
