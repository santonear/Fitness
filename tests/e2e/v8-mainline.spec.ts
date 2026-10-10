import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function onboard(page: Page) {
  await page.goto('/'); await expect(page).toHaveURL(/onboarding/);
  await page.getByLabel('你的回答').fill('想有些力量，不再容易累'); await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByLabel('你的回答').fill('每周 2 次，每次 20 分钟'); await page.getByRole('button', { name: '继续', exact: true }).click();
  await page.getByLabel('你的回答').fill('在家，只有瑜伽垫'); await page.getByRole('button', { name: '继续', exact: true }).click();
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
  await page.getByRole('button', { name: '完成本组', exact: true }).first().click();
  await expect(page.getByRole('button', { name: '已完成', exact: true })).toHaveCount(1);
  await page.reload(); await expect(page.getByRole('button', { name: '已完成', exact: true })).toHaveCount(1);
  await page.getByLabel('外观与版式').selectOption('liubai'); await expect(page.getByRole('button', { name: '已完成', exact: true })).toHaveCount(1);
  await page.getByLabel('外观与版式').selectOption('qingci');
  await page.getByRole('button', { name: '结束并记下', exact: true }).click();
  await page.getByLabel('时间不够', { exact: true }).check(); await page.getByLabel('备注（可选）').fill('今天先记一组');
  await page.getByRole('button', { name: '记下这次', exact: true }).click();
  await expect(page.getByRole('heading', { name: '本周回顾' })).toBeVisible();
  await expect(page.getByText('今天先记一组', { exact: true })).toBeVisible();
  const record = await page.evaluate(async () => { const p = '/src/persistence/db.ts'; const db = (await import(/* @vite-ignore */ p)).database; return { workouts: await db.v8Workouts.toArray(), versions: await db.v8PlanVersions.toArray() }; });
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
