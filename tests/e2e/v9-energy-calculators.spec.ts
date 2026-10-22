import { expect, test } from '@playwright/test';

/** Bo 2026-10-21: calorie and macro calculators under 我的; macros inherit the daily calories; no activity selector, no copy/share. */
test('calorie result carries into the macro calculator and both stay on this device', async ({ page }) => {
  const outbound: string[] = [];
  page.on('request', request => {
    if (request.method() !== 'GET') outbound.push(request.url());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/settings/calories');
  await expect(page.getByRole('heading', { name: '卡路里计算器' })).toBeVisible();
  await expect(page.getByText(/活动水平/)).toHaveCount(0);
  await page.getByRole('radiogroup', { name: '性别' }).getByRole('radio', { name: '女' }).click();
  for (const [label, value] of [
    ['年龄', '30'],
    ['身高', '165'],
    ['体重', '60'],
  ] as const) {
    const box = page.getByRole('textbox', { name: label, exact: true });
    await box.fill(value);
    await box.press('Enter');
  }
  // No plan yet: activity 1.2 → maintenance 1584, goals ±10%.
  await expect(page.getByRole('radio', { name: /保持\s*1,584/ })).toHaveAttribute('aria-checked', 'true');
  await page.getByRole('radio', { name: /减脂/ }).click();
  await expect(page.getByText('每天目标 1,426 千卡 / 天')).toBeAttached();
  await page.getByRole('button', { name: '用这个结果算宏量营养' }).click();

  await expect(page.getByRole('heading', { name: '宏量营养计算器' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '每日卡路里' })).toHaveValue('1426');
  await expect(page.getByText('来自卡路里计算器')).toBeVisible();
  await expect(page.getByText(/196\s*克/)).toBeVisible();
  await page.getByRole('radio', { name: /高蛋白/ }).click();
  await expect(page.getByText(/89\s*克/).first()).toBeVisible();
  await page.getByRole('button', { name: '多一餐' }).click();
  await expect(page.getByRole('group', { name: '每天几餐' })).toContainText('4');
  await expect(page.getByRole('button', { name: /复制|分享/ })).toHaveCount(0);
  expect(outbound.filter(url => !url.includes('/api/v1/monitoring'))).toEqual([]);
});
