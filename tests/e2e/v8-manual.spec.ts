import { expect, test } from '@playwright/test';

test('manual search, multi-select, filters and shared estimate lead to a multi-action workout', async ({ page }) => {
  await page.goto('/manual');
  await expect(page.getByRole('heading', { name: '手动训练', exact: true })).toBeVisible();
  const start = page.getByRole('button', { name: '开始', exact: true });
  await expect(start).toBeDisabled();
  const search = page.getByRole('searchbox', { name: '搜索动作' });
  await search.fill('squat');
  await page.getByRole('button', { name: '徒手深蹲', exact: true }).click();
  await search.fill('plank');
  await page.getByRole('button', { name: '平板支撑', exact: true }).click();
  await expect(page.locator('.manual-start')).toContainText('已选 2 个动作');
  await expect(page.locator('.manual-start')).toContainText('约 15 分钟');
  await page.getByRole('button', { name: '康复', exact: true }).click();
  await expect(page.getByText('请先咨询专业人士', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '清空筛选', exact: true }).click();
  await expect(search).toHaveValue('');
  await expect(page.locator('.manual-start')).toContainText('已选 2 个动作');
  await page.getByRole('button', { name: '健身房器械', exact: true }).click();
  await expect(page.getByRole('button', { name: '高位下拉机', exact: true })).toBeVisible();
  await expect(page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).resolves.toBe(true);
  await start.click();
  await expect(page).toHaveURL(/\/workout\//);
  const workout = await page.evaluate(async () => { const path = '/src/ui/mainline/context.tsx'; return (await (await import(/* @vite-ignore */ path)).workflow.snapshot()).active; });
  expect(workout.plannedExercises).toHaveLength(2);
  expect(workout.plannedSetCount).toBe(4);
});

test('empty and local helper states stay editable without a network AI request', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/v1/plans/generate', async route => { calls++; await route.abort(); });
  await page.goto('/manual');
  await page.getByRole('button', { name: '最近动作', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('还没有最近完成的动作');
  await page.getByRole('searchbox').fill('zzzzzzzzzz');
  await expect(page.getByText('暂时没有符合条件的动作，试试换个词或清空筛选。')).toBeVisible();
  await page.getByRole('button', { name: '清空筛选', exact: true }).click();
  await page.getByRole('button', { name: '芽芽帮配', exact: true }).click();
  await expect(page.getByRole('status')).toContainText('确认已满18岁');
  await expect(page.locator('.manual-start')).toContainText('已选 0 个动作');
  expect(calls).toBe(0);
});
