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
